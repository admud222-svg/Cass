function getPlaceholder(text, data) {
  let result = text;
  // Combine all data objects into one map for recursive resolution
  const allData = Object.assign({}, ...data);
  const MAX_DEPTH = 5; // Prevent infinite loops

  // First pass: Resolve placeholders in the text
  for (const [key, value] of Object.entries(allData)) {
    const placeholder = new RegExp(`@${key}`, "g");
    result = result.replace(placeholder, value);
  }

  // Recursive pass: Check if any values still contain placeholders
  let depth = 0;
  while (depth < MAX_DEPTH) {
    let changed = false;
    // Check if result still has potential placeholders
    if (!result.includes("@")) break;

    for (const [key, value] of Object.entries(allData)) {
      // Skip if key is not in result to avoid unnecessary regex
      if (!result.includes(`@${key}`)) continue;
      
      const placeholder = new RegExp(`@${key}`, "g");
      const newResult = result.replace(placeholder, value);
      
      if (newResult !== result) {
        result = newResult;
        changed = true;
      }
    }
    
    if (!changed) break;
    depth++;
  }

  return result;
}

export { getPlaceholder };