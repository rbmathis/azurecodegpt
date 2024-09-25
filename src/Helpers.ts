
/**
 * Fixes up the results by ensuring that any unclosed code blocks are properly closed.
 * It appends a closing code block delimiter if the number of code block delimiters is odd.
 * Additionally, it appends a separator line at the end of the result.
 *
 * @param result - The string result that may contain code blocks.
 * @returns The fixed-up result with properly closed code blocks and an appended separator line.
 */
export function ensureCodeBlocks(result:string): string {
            // close unclosed codeblocks
            // Use a regular expression to find all occurrences of the substring in the string
            const REGEX_CODEBLOCK = new RegExp("```", "g");
            const matches = result.match(REGEX_CODEBLOCK);
            // Return the number of occurrences of the substring in the response, check if even
            const count = matches ? matches.length : 0;
            if (count % 2 !== 0) {
                //  append ``` to the end to make the last code block complete
                result += "\n```";
            }

            result += `\n\n---\n`;
    return result;
}