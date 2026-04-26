// Utility to clean up interactive CLI output
// Removes repeated prompts from stdin character-by-character echoing

export function cleanCliOutput(output) {
  if (!output || typeof output !== 'string') return output;

  const lines = output.split('\n');
  const result = [];
  let pendingMenuQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip empty lines at start
    if (result.length === 0 && line.trim() === '') {
      continue;
    }

    // Skip menu option lines (lines that are just "  1 - Option One" etc)
    // But capture the selected one (with ❯)
    if (/^\s*[❯\s]*\d+\s*-\s*Option/.test(line)) {
      if (line.includes('❯') && pendingMenuQuestion) {
        // This is the selected option
        const optionMatch = line.match(/(\d+\s*-\s*Option\s*\w+)/);
        if (optionMatch) {
          result.push(`${pendingMenuQuestion}: ${optionMatch[1]}`);
          pendingMenuQuestion = null;
        }
      }
      continue;
    }

    // Skip lines that are just fragments like "6 - Option Six ? Select..."
    if (/^\d+\s*-\s*Option.*\?\s*Select/.test(line)) {
      continue;
    }

    // Handle menu question line
    if (line.includes('Select a number') && line.includes('(Use arrow keys)')) {
      // Store the question, wait for the selection
      pendingMenuQuestion = '? Select a number (1-6)';
      continue;
    }

    // Handle menu selection that appears on same line as question
    if (line.includes('Select a number') && line.includes('Option')) {
      const selectMatch = line.match(/(\d+\s*-\s*Option\s*\w+)\s*$/);
      if (selectMatch) {
        line = `? Select a number (1-6): ${selectMatch[1]}`;
        pendingMenuQuestion = null;
      }
    }

    // Handle lines with repeated prompts (character-by-character echo)
    // Pattern: "? Question: ? Question: a? Question: ab? Question: abc"
    if (line.includes('? ') && (line.match(/\? /g) || []).length > 1) {
      // Find all "? Something: " patterns and get the last complete answer
      const promptMatches = [...line.matchAll(/\? ([^?]+?):\s*/g)];
      if (promptMatches.length > 0) {
        // Get the first prompt text (they should all be the same)
        const promptText = promptMatches[0][1].replace(/\([^)]*\)\s*$/, '').trim();

        // Find what comes after the LAST ": "
        const lastColonIndex = line.lastIndexOf(': ');
        if (lastColonIndex !== -1) {
          const answer = line.substring(lastColonIndex + 2).trim();
          line = `? ${promptText}: ${answer}`;
        }
      }
    }

    // Clean up default value hints like "(main)" in prompts
    if (line.includes('(') && line.includes(')') && line.includes('? ')) {
      line = line.replace(/\([^)]+\)\s*\?/g, '?');
    }

    // Skip duplicate adjacent lines
    if (result.length > 0 && result[result.length - 1] === line) {
      continue;
    }

    // Skip lines that are clearly menu artifacts
    if (/^[❯\s]+\d+\s*-/.test(line)) {
      continue;
    }

    result.push(line);
  }

  // If we still have a pending menu question without selection, add it anyway
  if (pendingMenuQuestion) {
    result.push(pendingMenuQuestion + ':');
  }

  return result.join('\n').trim();
}
