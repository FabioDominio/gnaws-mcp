#!/usr/bin/env node
import {existsSync, readFileSync, writeFileSync} from "fs";
import {join} from "node:path";

// Load .env if present (local dev convenience — ignored if no .env exists)
if (existsSync(".env")) {

    process.loadEnvFile(".env");

}

import type {AwsCredentialIdentityProvider} from "@aws-sdk/types";
import {fromIni} from "@aws-sdk/credential-providers";
import {Inventory, GraphBuilder, MarkdownExporter, GexfExporter, JsonExporter, LiveServiceFactory, CacheServiceFactory, CacheWriter, UnusedDetector} from "@gnaws/core";
import type {DirectedGraph} from "graphology";
import {McpServer} from "@modelcontextprotocol/server";
import {StdioServerTransport} from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {createLogger} from "./logger.js";

// State
let inventory: Inventory | undefined;
let graph: DirectedGraph | undefined;

const logLevel = (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error" | "silent";
const logger = createLogger(logLevel);

const server = new McpServer({
    "name": "gnaws-mcp",
    "version": "0.1.0"
});

// ─── Tool: status ────────────────────────────────────────────────────────────

server.registerTool(
    "status",
    {
        "title": "Server Status",
        "description": "Check the current state of the gnaws server: whether resources are loaded, graph size, and available actions. Call this first to understand what tools are available.",
        "inputSchema": z.object({})
    },
    () => {

        const lines: string[] = [];

        if (graph && inventory) {

            const regions = inventory.getAccountRegions();
            lines.push(
                "✓ Resources loaded.",
                `  Nodes: ${String(graph.order)}`,
                `  Edges: ${String(graph.size)}`,
                `  Regions: ${String(regions.length)}`,
                "",
                "Available tools:",
                "  • 'detect' — find unused/orphaned resources",
                "  • 'export' — export graph to gexf, json, or markdown",
                "  • 'dump' — save raw data to disk",
                "  • 'regions' — list enabled AWS regions",
                "  • 'scan' — re-scan with a different profile",
                "  • 'load' — load a different dump"
            );

        } else {

            lines.push(
                "✗ No resources loaded yet.",
                "",
                "To get started, call one of:",
                "  • 'scan' — scan live AWS resources (requires an AWS profile name)",
                "  • 'load' — load from a dump directory (requires a path)"
            );

        }

        return {
            "content": [
                {
                    "type": "text" as const,
                    "text": lines.join("\n")
                }
            ]
        };

    }
);

// ─── Tool: scan ──────────────────────────────────────────────────────────────

server.registerTool(
    "scan",
    {
        "title": "Scan AWS Resources",
        "description": "Scan AWS resources live using an AWS profile. This builds an in-memory graph of all resources and their relationships. This is a long-running operation (may take several minutes). After scanning, use 'regions' to list regions, 'detect' to find unused resources, 'export' to export the graph, or 'dump' to save raw data for offline use.",
        "inputSchema": z.object({"profile": z.string().describe("AWS profile name from ~/.aws/credentials (e.g., 'default', 'production')")})
    },
    async ({profile}, ctx) => {

        const progressToken = ctx.mcpReq._meta?.progressToken;

        const reportProgress = async (progress: number, total: number, message: string): Promise<void> => {

            if (progressToken !== undefined) {

                await ctx.mcpReq.notify({
                    "method": "notifications/progress",
                    "params": {progressToken,
                        progress,
                        total,
                        message}
                });

            }

        };

        try {

            await reportProgress(
                1,
                4,
                "Resolving credentials..."
            );
            const credentials: AwsCredentialIdentityProvider = fromIni({profile});
            logger.info(`Scanning AWS resources with profile [${profile}]...`);

            await reportProgress(
                2,
                4,
                "Initializing services..."
            );
            inventory = new Inventory(
                credentials,
                new LiveServiceFactory(logger.child("aws"))
            );
            await inventory.init();

            await reportProgress(
                3,
                4,
                "Loading resources (this may take several minutes)..."
            );
            await inventory.loadResources();

            await reportProgress(
                4,
                4,
                "Building graph..."
            );
            graph = new GraphBuilder().build(inventory);
            logger.info(`Scan complete: ${String(graph.order)} nodes, ${String(graph.size)} edges`);

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": [
                            `✓ Scan complete: ${String(graph.order)} nodes, ${String(graph.size)} edges.`,
                            "",
                            "Available next steps:",
                            "  • 'regions' — list enabled AWS regions",
                            "  • 'detect' — find unused/orphaned resources",
                            "  • 'export' — export graph to gexf, json, or markdown",
                            "  • 'dump' — save raw data to disk for offline analysis"
                        ].join("\n")
                    }
                ]
            };

        } catch (error) {

            graph = undefined;
            inventory = undefined;
            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✗ Scan failed: ${error instanceof Error
                            ? error.message
                            : String(error)}\n\nEnsure the AWS profile '${profile}' exists in ~/.aws/credentials and has valid credentials.`
                    }
                ],
                "isError": true
            };

        }

    }
);

// ─── Tool: load ──────────────────────────────────────────────────────────────

server.registerTool(
    "load",
    {
        "title": "Load Cached Resources",
        "description": "Load resources from a previously dumped directory (offline mode). No AWS credentials needed. After loading, use 'regions', 'detect', or 'export' to work with the data.",
        "inputSchema": z.object({"path": z.string().describe("Path to a gnaws dump directory containing manifest.json and resource files")})
    },
    async ({path}, ctx) => {

        const progressToken = ctx.mcpReq._meta?.progressToken;

        const reportProgress = async (progress: number, total: number, message: string): Promise<void> => {

            if (progressToken !== undefined) {

                await ctx.mcpReq.notify({
                    "method": "notifications/progress",
                    "params": {progressToken,
                        progress,
                        total,
                        message}
                });

            }

        };

        if (!existsSync(path)) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✗ Path not found: ${path}\n\nProvide the path to a directory created by the 'dump' tool (or gnaws-cli /dump command).`
                    }
                ],
                "isError": true
            };

        }

        try {

            await reportProgress(
                1,
                3,
                "Reading manifest..."
            );
            const manifestPath = join(
                path,
                "manifest.json"
            );
            let manifestInfo = "";
            if (existsSync(manifestPath)) {

                const manifest = JSON.parse(readFileSync(
                    manifestPath,
                    "utf-8"
                )) as {
                    "scannedAt"?: string;
                    "regions"?: string[];
                };
                manifestInfo = `  Scanned at: ${manifest.scannedAt ?? "unknown"}\n  Regions: ${String(manifest.regions?.length ?? "unknown")}`;

            }

            await reportProgress(
                2,
                3,
                "Loading cached resources..."
            );
            inventory = new Inventory(new CacheServiceFactory(
                path,
                logger.child("cache")
            ));
            await inventory.init();
            await inventory.loadResources();

            await reportProgress(
                3,
                3,
                "Building graph..."
            );
            graph = new GraphBuilder().build(inventory);

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": [
                            `✓ Loaded from ${path}: ${String(graph.order)} nodes, ${String(graph.size)} edges.`,
                            manifestInfo
                                ? `\n${manifestInfo}`
                                : "",
                            "",
                            "Available next steps:",
                            "  • 'regions' — list enabled AWS regions",
                            "  • 'detect' — find unused/orphaned resources",
                            "  • 'export' — export graph to gexf, json, or markdown"
                        ].join("\n")
                    }
                ]
            };

        } catch (error) {

            graph = undefined;
            inventory = undefined;
            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✗ Load failed: ${error instanceof Error
                            ? error.message
                            : String(error)}\n\nEnsure the directory was created by gnaws dump and contains valid resource files.`
                    }
                ],
                "isError": true
            };

        }

    }
);

// ─── Tool: regions ───────────────────────────────────────────────────────────

server.registerTool(
    "regions",
    {
        "title": "List Regions",
        "description": "List enabled AWS regions from the loaded inventory. Requires 'scan' or 'load' to be called first.",
        "inputSchema": z.object({})
    },
    () => {

        if (!inventory) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": "✗ No inventory loaded. Call 'scan' (with an AWS profile) or 'load' (with a dump directory) first."
                    }
                ],
                "isError": true
            };

        }

        const regions = inventory.getAccountRegions();
        const regionNames = regions.map((r) => r.RegionName ?? "unknown");

        return {
            "content": [
                {
                    "type": "text" as const,
                    "text": [
                        `${String(regions.length)} enabled regions:`,
                        "",
                        ...regionNames.map((name) => `  • ${name}`)
                    ].join("\n")
                }
            ]
        };

    }
);

// ─── Tool: detect ────────────────────────────────────────────────────────────

server.registerTool(
    "detect",
    {
        "title": "Detect Unused Resources",
        "description": "Detect structurally unused/orphaned resources in the loaded graph. Requires 'scan' or 'load' to be called first. Optionally export findings to a file (.json or .md).",
        "inputSchema": z.object({"outputPath": z.string().optional().
            describe("Optional path to write findings (.json or .md). If omitted, returns findings as text.")})
    },
    ({outputPath}) => {

        if (!graph || !inventory) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": "✗ No graph built yet. Call 'scan' or 'load' first to build the resource graph."
                    }
                ],
                "isError": true
            };

        }

        try {

            const detector = new UnusedDetector();
            const findings = detector.detect(
                inventory,
                graph
            );

            if (findings.length === 0) {

                return {
                    "content": [
                        {
                            "type": "text" as const,
                            "text": "✓ No unused resources detected. All resources have structural connections."
                        }
                    ]
                };

            }

            // Export to file if path provided
            if (outputPath) {

                if (outputPath.endsWith(".json")) {

                    writeFileSync(
                        outputPath,
                        JSON.stringify(
                            findings,
                            null,
                            2
                        )
                    );

                } else if (outputPath.endsWith(".md")) {

                    const lines = [
                        "# Unused Resources",
                        "",
                        `> ${String(findings.length)} findings detected`,
                        "",
                        "| Confidence | Resource | ARN | Type | Region | Reason |",
                        "|------------|----------|-----|------|--------|--------|",
                        ...findings.map((f) => `| ${f.confidence} | ${f.name} | ${f.arn} | ${f.resourceType} | ${f.region} | ${f.reason} |`)
                    ];
                    writeFileSync(
                        outputPath,
                        lines.join("\n")
                    );

                } else {

                    return {
                        "content": [
                            {
                                "type": "text" as const,
                                "text": "✗ Unsupported output format. Use .json or .md extension."
                            }
                        ],
                        "isError": true
                    };

                }

                return {
                    "content": [
                        {
                            "type": "text" as const,
                            "text": `✓ ${String(findings.length)} unused resources found and written to ${outputPath}.`
                        }
                    ]
                };

            }

            // Return findings as text
            const summary = findings.map((f) => `  [${f.confidence}] ${f.resourceType} | ${f.region} | ${f.name} — ${f.reason}`);

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": [
                            `${String(findings.length)} unused resources detected:`,
                            "",
                            ...summary,
                            "",
                            "Tip: call 'detect' with outputPath (.json or .md) to save findings to a file."
                        ].join("\n")
                    }
                ]
            };

        } catch (error) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✗ Detection failed: ${error instanceof Error
                            ? error.message
                            : String(error)}`
                    }
                ],
                "isError": true
            };

        }

    }
);

// ─── Tool: export ────────────────────────────────────────────────────────────

server.registerTool(
    "export",
    {
        "title": "Export Graph",
        "description": "Export the resource graph to a file. Requires 'scan' or 'load' to be called first. Supported formats: gexf (Gephi), json (sigma.js viewer), md (markdown report).",
        "inputSchema": z.object({
            "format": z.enum([
                "gexf",
                "json",
                "md"
            ]).describe("Export format: 'gexf' for Gephi, 'json' for sigma.js viewer, 'md' for markdown report"),
            "path": z.string().optional().
                describe("Output file path. Defaults to graph.gexf, graph.json, or report.md")
        })
    },
    ({format, path}) => {

        if (!graph || !inventory) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": "✗ No graph built yet. Call 'scan' or 'load' first to build the resource graph."
                    }
                ],
                "isError": true
            };

        }

        try {

            const ext = format === "md"
                ? ".md"
                : `.${format}`;
            const defaultName = format === "md"
                ? "report.md"
                : `graph.${format}`;
            let outputPath = path ?? defaultName;
            if (!outputPath.endsWith(ext)) {

                outputPath += ext;

            }

            if (format === "gexf") {

                new GexfExporter().export(
                    outputPath,
                    inventory,
                    graph
                );

            } else if (format === "json") {

                new JsonExporter().export(
                    outputPath,
                    inventory,
                    graph
                );

            } else {

                new MarkdownExporter().export(
                    outputPath,
                    inventory,
                    graph
                );

            }

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✓ Exported ${String(graph.order)} nodes and ${String(graph.size)} edges to ${outputPath}.`
                    }
                ]
            };

        } catch (error) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✗ Export failed: ${error instanceof Error
                            ? error.message
                            : String(error)}`
                    }
                ],
                "isError": true
            };

        }

    }
);

// ─── Tool: dump ──────────────────────────────────────────────────────────────

server.registerTool(
    "dump",
    {
        "title": "Dump Resources",
        "description": "Dump loaded resources to a directory for offline use. Requires 'scan' or 'load' to be called first. The output can later be used with 'load' for offline analysis.",
        "inputSchema": z.object({"path": z.string().optional().
            describe("Output directory path. Defaults to 'dump'.")})
    },
    ({path}) => {

        if (!inventory) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": "✗ No inventory loaded. Call 'scan' or 'load' first."
                    }
                ],
                "isError": true
            };

        }

        try {

            const outputDir = path ?? "dump";
            const writer = new CacheWriter(outputDir);
            writer.writeAll(inventory);

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": [
                            `✓ Resources dumped to ${outputDir}.`,
                            "",
                            "The dump can be loaded later with the 'load' tool for offline analysis."
                        ].join("\n")
                    }
                ]
            };

        } catch (error) {

            return {
                "content": [
                    {
                        "type": "text" as const,
                        "text": `✗ Dump failed: ${error instanceof Error
                            ? error.message
                            : String(error)}`
                    }
                ],
                "isError": true
            };

        }

    }
);

// ─── Main ────────────────────────────────────────────────────────────────────

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "[gnaws-mcp] Uncaught exception:",
            error
        );
        process.exit(1);

    }
);

process.on(
    "unhandledRejection",
    (reason) => {

        console.error(
            "[gnaws-mcp] Unhandled rejection:",
            reason
        );
        process.exit(1);

    }
);

async function main (): Promise<void> {

    const transport = new StdioServerTransport();
    await server.connect(transport);

}

main().catch((error: unknown) => {

    console.error(
        "[gnaws-mcp] Fatal error in main():",
        error
    );
    process.exit(1);

});
