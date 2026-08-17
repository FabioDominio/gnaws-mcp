type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const levels: LogLevel[] = [
    "debug",
    "info",
    "warn",
    "error",
    "silent"
];

/**
 * Minimal logger with level filtering and module prefixing.
 * All output goes to stderr to avoid polluting the MCP stdio transport channel.
 * Compatible with the AWS SDK `logger` client option.
 */
export interface Logger {
    debug (...args: unknown[]): void;
    info (...args: unknown[]): void;
    warn (...args: unknown[]): void;
    error (...args: unknown[]): void;
    child (prefix: string): Logger;
}

export function createLogger (level: LogLevel = "info"): Logger {

    const threshold = levels.indexOf(level);

    function buildLogger (prefix?: string): Logger {

        const tag = prefix
            ? `[${prefix}]`
            : "";

        return {
            debug (...args: unknown[]) {

                if (threshold <= 0) console.error(
                    tag,
                    ...args
                );

            },
            info (...args: unknown[]) {

                if (threshold <= 1) console.error(
                    tag,
                    ...args
                );

            },
            warn (...args: unknown[]) {

                if (threshold <= 2) console.error(
                    tag,
                    ...args
                );

            },
            error (...args: unknown[]) {

                if (threshold <= 3) console.error(
                    tag,
                    ...args
                );

            },
            child (childPrefix: string): Logger {

                const newPrefix = prefix
                    ? `${prefix}/${childPrefix}`
                    : childPrefix;
                return buildLogger(newPrefix);

            }
        };

    }

    return buildLogger();

}
