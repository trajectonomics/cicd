/** Basic metadata describing a repository package initialized from this template. */
export interface TemplateInfo {
	readonly name: string
	readonly version: string
	readonly initialized: boolean
}

/**
 * Returns package information verifying the template structure is operational.
 */
export function getTemplateInfo(): TemplateInfo {
	return Object.freeze({
		name: "@trajectonomics/technical-template",
		version: "0.0.0-development",
		initialized: true,
	})
}
