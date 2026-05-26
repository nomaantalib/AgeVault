/**
 * OCR Parser utility for AgeVault
 * Extracts Full Name and Date of Birth (DOB) from various ID card formats.
 */

// Words that the name itself should not contain.
const NAME_STOP_WORDS = [
  'government', 'india', 'unique', 'authority', 'enrollment', 'enrolment', 
  'download', 'to', 'signature', 'date', 'helpdesk', 'website', 'uidai', 
  'male', 'female', 'gender', 'relation', 'address', 'card', 'identity', 
  'national', 'republic', 'valid', 'issue', 'expiry', 'birth', 'yob', 'dob', 
  'permanent', 'income', 'tax', 'department', 'licence', 'license', 'passport',
  'type', 'code', 'country', 'document', 'no', 'number', 'holder', 'photo', 
  'registration', 'name', 'surname', 'given name', 'given names', 'first name', 
  'last name', 'middle name', 'state', 'ministry', 'department', 'permanent account'
];

// Words or phrases in the raw line that indicate it's metadata, a header, or a relative's info.
const LINE_STOP_WORDS = [
  's/o', 'd/o', 'c/o', 'w/o', 'son of', 'daughter of', 'wife of', 'care of', 
  'father', 'mother', 'husband', 'address', 'uidai', 'helpdesk', 'website', 
  'signature', 'thumb', 'impression', 'validity', 'expiry', 'permanent account number', 
  'income tax department', 'government of india', 'unique identification', 
  'passport no', 'passport number', 'document no', 'document number', 
  'licence no', 'license no', 'driving licence', 'driving license'
];

/**
 * Evaluates whether a candidate string is a plausible legal name
 */
const isPlausibleName = (name, rawLine) => {
  if (!name) return false;
  
  // Clean string
  const cleaned = name.replace(/[^a-zA-Z\s]/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 50) return false; // Allow up to 50 chars for South Indian names
  
  // A valid name typically does not contain digits
  if (/\d/.test(cleaned)) return false;

  // Split into words and check
  const words = cleaned.split(/\s+/);
  if (words.length < 1) return false;

  const lowercaseCleaned = cleaned.toLowerCase();
  const lowercaseRaw = rawLine ? rawLine.toLowerCase() : lowercaseCleaned;

  // 1. Check if the name itself contains a forbidden word
  const hasNameStopWord = NAME_STOP_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowercaseCleaned);
  });
  if (hasNameStopWord) return false;

  // 2. Check if the raw line contains any relationship or metadata indicators
  const hasLineStopWord = LINE_STOP_WORDS.some(word => {
    return lowercaseRaw.includes(word);
  });
  if (hasLineStopWord) return false;

  // 3. Check for relationship prefixes that get cleaned (e.g. S/O -> SO)
  const cleanedWords = lowercaseCleaned.split(/\s+/);
  const blockedPrefixes = ['so', 'do', 'co', 'wo'];
  const hasRelationPrefix = blockedPrefixes.some(prefix => cleanedWords.includes(prefix));
  if (hasRelationPrefix) return false;

  return true;
};

/**
 * Formats a name string by capitalizing first letters
 */
const formatName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-zA-Z\s\.]/g, '') // Keep letters, spaces, dots
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
};

/**
 * Helper to extract name from a line containing a name label, or the subsequent line.
 */
const extractNameFromLabelLine = (line, nextLine) => {
  // Check if value is on the same line after a separator (like colon, hyphen, equals)
  const separatorMatch = line.match(/(?:name|holder|fn|ln|nom|prénom|prenom)\s*[:\-\=]\s*(.+)/i);
  if (separatorMatch && separatorMatch[1]) {
    const candidate = separatorMatch[1].replace(/[^a-zA-Z\s]/g, '').trim();
    if (isPlausibleName(candidate, line)) {
      return formatName(candidate);
    }
  }
  
  // Otherwise, if the next line is a valid candidate name, return it
  if (nextLine) {
    const candidate = nextLine.replace(/[^a-zA-Z\s]/g, '').trim();
    if (isPlausibleName(candidate, nextLine)) {
      return formatName(candidate);
    }
  }
  
  return '';
};

/**
 * Normalizes date strings and attempts to parse into YYYY-MM-DD
 */
export const extractDate = (text) => {
  if (!text) return '';

  // Month names mapping
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  // 1. Spacing normalizations
  // e.g. "12 / 03 / 1995" -> "12/03/1995"
  // Also replaces separator symbols like pipes, dots, spaces, slashes with a standard "/"
  let normalized = text.replace(/(\d{1,4})\s*[\/|\-\.\,_\\\s]+\s*(\d{1,2})\s*[\/|\-\.\,_\\\s]+\s*(\d{1,4})/g, '$1/$2/$3');
  
  // Try to find standard date patterns
  // DD/MM/YYYY or MM/DD/YYYY
  const standardDateRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
  const standardMatch = normalized.match(standardDateRegex);
  if (standardMatch) {
    let d = parseInt(standardMatch[1], 10);
    let m = parseInt(standardMatch[2], 10);
    const y = parseInt(standardMatch[3], 10);
    
    // Validate and fix DD/MM/YYYY vs MM/DD/YYYY
    if (m > 12 && d <= 12) {
      // Swap if month is > 12 and day is <= 12
      const temp = d;
      d = m;
      m = temp;
    }
    
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    if (d > 0 && d <= 31 && m > 0 && m <= 12 && y > 1920 && y <= new Date().getFullYear()) {
      return `${y}-${monthStr}-${dayStr}`;
    }
  }

  // YYYY/MM/DD
  const ymdRegex = /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/;
  const ymdMatch = normalized.match(ymdRegex);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    if (d > 0 && d <= 31 && m > 0 && m <= 12 && y > 1920 && y <= new Date().getFullYear()) {
      return `${y}-${monthStr}-${dayStr}`;
    }
  }

  // Text month formats: e.g. "15 Aug 1990", "15-August-1990", "August 15, 1990"
  // Format A: DD [separator] MONTH [separator] YYYY
  const textMonthRegexA = /\b(\d{1,2})[\s\-\/\.]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/\.,]*(\d{4})\b/i;
  const textMonthMatchA = text.match(textMonthRegexA);
  if (textMonthMatchA) {
    const d = parseInt(textMonthMatchA[1], 10);
    const mStr = monthMap[textMonthMatchA[2].toLowerCase()];
    const y = parseInt(textMonthMatchA[3], 10);
    const dayStr = String(d).padStart(2, '0');
    if (d > 0 && d <= 31 && mStr && y > 1920 && y <= new Date().getFullYear()) {
      return `${y}-${mStr}-${dayStr}`;
    }
  }

  // Format B: MONTH [separator] DD [separator] YYYY
  const textMonthRegexB = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/\.,]*(\d{1,2})[\s\-\/\.,]*(\d{4})\b/i;
  const textMonthMatchB = text.match(textMonthRegexB);
  if (textMonthMatchB) {
    const mStr = monthMap[textMonthMatchB[1].toLowerCase()];
    const d = parseInt(textMonthMatchB[2], 10);
    const y = parseInt(textMonthMatchB[3], 10);
    const dayStr = String(d).padStart(2, '0');
    if (d > 0 && d <= 31 && mStr && y > 1920 && y <= new Date().getFullYear()) {
      return `${y}-${mStr}-${dayStr}`;
    }
  }

  // Fallback: Year of Birth (YOB) e.g., "Year of Birth : 1990" or "YOB: 1990"
  const yobRegex = /(?:year of birth|yob|birth year|birth|year)\s*[:\-\/\=]?\s*(\d{4})\b/i;
  const yobMatch = text.match(yobRegex);
  if (yobMatch) {
    const y = parseInt(yobMatch[1], 10);
    if (y > 1920 && y <= new Date().getFullYear()) {
      return `${y}-01-01`; // Default to Jan 1st of that year
    }
  }

  // Super fallback: Find any 4-digit number between 1920 and current year that isn't part of card numbers
  const currentYearFull = new Date().getFullYear();
  const yearPattern = new RegExp(`\\b(19\\d{2}|2[0-${Math.floor(currentYearFull / 10) % 10}][0-9]\\d)\\b`, 'g');
  const years = text.match(yearPattern);
  if (years) {
    // Return first reasonable year
    for (const yStr of years) {
      const y = parseInt(yStr, 10);
      if (y > 1920 && y < currentYearFull - 5) {
        return `${y}-01-01`;
      }
    }
  }

  return '';
};

/**
 * Extracts Identification Number from ID Card text based on card type
 */
export const extractIdNumber = (text, idType) => {
  if (!text) return '';

  const cleanText = text.toUpperCase();

  // 1. Aadhaar Card (12 digits, often formatted as xxxx xxxx xxxx or xxxxxxxxxxxx)
  if (idType === 'aadhaar') {
    const aadhaarMatch = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/) || text.match(/\b\d{12}\b/);
    if (aadhaarMatch) {
      return aadhaarMatch[0].trim();
    }
  }

  // 2. PAN Card (10 alphanumeric characters: 5 letters, 4 digits, 1 letter)
  if (idType === 'pan') {
    const panMatch = cleanText.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
    if (panMatch) {
      return panMatch[0];
    }
  }

  // 3. Passport (Typically a letter followed by 7 digits, or 8-9 alphanumeric characters)
  if (idType === 'passport') {
    const passportMatch = cleanText.match(/\b[A-Z]\d{7}\b/) || cleanText.match(/\b[A-Z0-9]{8,9}\b/);
    if (passportMatch) {
      return passportMatch[0];
    }
  }

  // 4. Driver's License (Alphanumeric DL format)
  if (idType === 'license') {
    const dlMatch = cleanText.match(/\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7}\b/) || 
                    cleanText.match(/\b[A-Z]{2}\d{13}\b/) || 
                    cleanText.match(/\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b/);
    if (dlMatch) {
      return dlMatch[0];
    }
  }

  // Generic fallback: Search for standard PAN, Aadhaar or Passport format anyway
  const genericPan = cleanText.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
  if (genericPan) return genericPan[0];

  const genericAadhaar = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/) || text.match(/\b\d{12}\b/);
  if (genericAadhaar) return genericAadhaar[0];

  const genericPassport = cleanText.match(/\b[A-Z]\d{7}\b/);
  if (genericPassport) return genericPassport[0];

  return '';
};

/**
 * Main parse entry point
 */
export const parseOcrText = (text, idType) => {
  if (!text) return { dob: '', name: '', idNumber: '' };

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let dob = '';
  let name = '';

  // Extract DOB first as it's highly recognizable
  // 1. Search lines containing DOB labels first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('dob') || line.includes('birth') || line.includes('d.o.b') || line.includes('date of') || line.includes('yob')) {
      const foundDate = extractDate(lines[i]);
      if (foundDate) {
        dob = foundDate;
        break;
      }
      // Check next line just in case date is on next line
      if (i < lines.length - 1) {
        const foundDateNext = extractDate(lines[i + 1]);
        if (foundDateNext) {
          dob = foundDateNext;
          break;
        }
      }
    }
  }

  // 2. If no DOB found, search anywhere
  if (!dob) {
    dob = extractDate(text);
  }

  // --- ID TYPE SPECIFIC PARSING FOR NAME ---

  // 1. PASSPORT (with MRZ support)
  if (idType === 'passport') {
    // Try to find Passport MRZ first (typically at the bottom)
    // Format is two lines of 44 characters
    let mrzLine1 = '';
    let mrzLine2 = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s/g, '').toUpperCase();
      // Line 1 starts with P<
      if (line.startsWith('P<') && line.length >= 35) {
        mrzLine1 = line;
        // The next line or nearby line should be line 2
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const nextLine = lines[j].replace(/\s/g, '').toUpperCase();
          if (nextLine.length >= 35 && /\d/.test(nextLine) && (nextLine.includes('<') || nextLine.length === 44)) {
            mrzLine2 = nextLine;
            break;
          }
        }
        if (mrzLine1 && mrzLine2) break;
      }
    }

    if (mrzLine1 && mrzLine2) {
      console.log('Found Passport MRZ lines:', { mrzLine1, mrzLine2 });
      try {
        // Parse Name from Line 1: P<INDSHARMA<<RAHUL<KUMAR<<<<
        // Strip P< + 3 letter country code = 5 chars
        const namePart = mrzLine1.substring(5);
        const nameSegments = namePart.split('<<');
        const surnameRaw = nameSegments[0] || '';
        const givenNamesRaw = nameSegments[1] || '';

        const surname = surnameRaw.replace(/</g, ' ').trim();
        // Replace all '<' in given names with space and trim
        const givenNames = givenNamesRaw.replace(/</g, ' ').trim();

        name = formatName(`${givenNames} ${surname}`);

        // Parse DOB from Line 2: YYMMDD format starting at index 13
        if (mrzLine2.length >= 19) {
          const dobPart = mrzLine2.substring(13, 19);
          if (/^\d{6}$/.test(dobPart)) {
            const yy = parseInt(dobPart.substring(0, 2), 10);
            const mm = dobPart.substring(2, 4);
            const dd = dobPart.substring(4, 6);
            const currentYear = new Date().getFullYear();
            const threshold = currentYear % 100; // e.g. 26
            const year = yy > threshold ? 1900 + yy : 2000 + yy;
            dob = `${year}-${mm}-${dd}`;
          }
        }
      } catch (err) {
        console.error('Error parsing Passport MRZ:', err);
      }
    }

    // Fallback: Label-based parsing if MRZ fails or is cut off
    if (!name) {
      let surname = '';
      let givenNames = '';
      for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].toLowerCase();
        if (cleanLine.includes('surname') || cleanLine.includes('nom')) {
          const candidate = extractNameFromLabelLine(lines[i], lines[i + 1]);
          if (candidate) surname = candidate;
        }
        if (cleanLine.includes('given name') || cleanLine.includes('givenname') || cleanLine.includes('prénom') || cleanLine.includes('prenom')) {
          const candidate = extractNameFromLabelLine(lines[i], lines[i + 1]);
          if (candidate) givenNames = candidate;
        }
      }
      if (givenNames || surname) {
        name = formatName(`${givenNames} ${surname}`);
      }
    }
  }

  // 2. PAN CARD
  else if (idType === 'pan') {
    // PAN card names are usually the first uppercase alphabetical lines after the header.
    // Let's first search for the label "Name" or "Father's Name"
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].toLowerCase();
      if (cleanLine.includes('name') && !cleanLine.includes('father') && !cleanLine.includes('mother') && !cleanLine.includes('department')) {
        const extracted = extractNameFromLabelLine(lines[i], lines[i + 1]);
        if (extracted) {
          name = extracted;
          break;
        }
      }
    }

    // If still not found, search by uppercase line sequence
    if (!name) {
      const uppercaseCandidates = [];
      const PAN_BOILERPLATE = ['INCOME', 'TAX', 'DEPARTMENT', 'GOVT', 'INDIA', 'PERMANENT', 'ACCOUNT', 'NUMBER', 'CARD', 'FATHER', 'SIGNATURE'];
      
      for (const line of lines) {
        // Must contain only uppercase letters, spaces, dots
        if (/^[A-Z\s\.]+$/.test(line.trim())) {
          const cleanLine = line.trim();
          const isHeader = PAN_BOILERPLATE.some(word => cleanLine.includes(word));
          if (!isHeader && cleanLine.replace(/[^A-Z]/g, '').length > 4) {
            uppercaseCandidates.push(cleanLine);
          }
        }
      }
      
      // The first candidate is Name. The second is Father's Name.
      if (uppercaseCandidates.length > 0) {
        const candidate = uppercaseCandidates[0];
        if (isPlausibleName(candidate, candidate)) {
          name = formatName(candidate);
        }
      }
    }
  }

  // 3. AADHAAR CARD
  else if (idType === 'aadhaar') {
    // Aadhaar names are typically located above the DOB line or Gender line.
    // Let's locate the DOB or Gender line
    let dobLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].toLowerCase();
      if (cleanLine.includes('dob') || cleanLine.includes('birth') || cleanLine.includes('yob') || cleanLine.includes('male') || cleanLine.includes('female') || cleanLine.includes('gender')) {
        dobLineIdx = i;
        break;
      }
    }

    if (dobLineIdx !== -1) {
      // Look upwards for a valid name
      for (let j = dobLineIdx - 1; j >= Math.max(0, dobLineIdx - 4); j--) {
        const cleanCandidate = lines[j].replace(/[^a-zA-Z\s\.]/g, '').trim();
        if (isPlausibleName(cleanCandidate, lines[j])) {
          // Check word count: Aadhaar name usually has at least 2 words
          if (cleanCandidate.split(/\s+/).length >= 2) {
            name = formatName(cleanCandidate);
            break;
          }
        }
      }

      // If no 2-word name found upwards, accept 1-word name
      if (!name) {
        for (let j = dobLineIdx - 1; j >= Math.max(0, dobLineIdx - 4); j--) {
          const cleanCandidate = lines[j].replace(/[^a-zA-Z\s\.]/g, '').trim();
          if (isPlausibleName(cleanCandidate, lines[j])) {
            name = formatName(cleanCandidate);
            break;
          }
        }
      }
    }

    // Fallback: If no DOB line index found or no name extracted above it, check for a line after "Government of India" / "Unique Identification Authority"
    if (!name) {
      let govIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].toLowerCase();
        if (cleanLine.includes('government of') || cleanLine.includes('unique identification')) {
          govIdx = i;
          break;
        }
      }
      if (govIdx !== -1 && govIdx < lines.length - 2) {
        // Look at next few lines
        for (let k = govIdx + 1; k <= Math.min(govIdx + 3, lines.length - 1); k++) {
          const cleanCandidate = lines[k].replace(/[^a-zA-Z\s\.]/g, '').trim();
          if (isPlausibleName(cleanCandidate, lines[k]) && cleanCandidate.split(/\s+/).length >= 2) {
            name = formatName(cleanCandidate);
            break;
          }
        }
      }
    }
  }

  // 4. DRIVER'S LICENSE
  else if (idType === 'license') {
    // Check for "Name", "FN LN", etc.
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].toLowerCase();
      if (cleanLine.includes('name') || cleanLine.includes('holder') || cleanLine.startsWith('fn') || cleanLine.startsWith('ln')) {
        const extracted = extractNameFromLabelLine(lines[i], lines[i + 1]);
        if (extracted) {
          name = extracted;
          break;
        }
      }
    }
  }

  // --- GENERIC FALLBACK FOR ANY ID TYPE OR FAILURE ---
  if (!name) {
    // Look for lines containing labels like "name:" or "holder:" or similar
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].toLowerCase();
      if (cleanLine.includes('name') && !cleanLine.includes('father') && !cleanLine.includes('mother')) {
        const extracted = extractNameFromLabelLine(lines[i], lines[i + 1]);
        if (extracted) {
          name = extracted;
          break;
        }
      }
    }
  }

  if (!name) {
    const scoredCandidates = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Keep only letters and spaces
      const cleanLine = line.replace(/[^a-zA-Z\s]/g, '').trim();
      
      if (isPlausibleName(cleanLine, line)) {
        let score = 0;
        const words = cleanLine.split(/\s+/);
        
        // 2 or 3 words are ideal for a name (First [Middle] Last)
        if (words.length === 2 || words.length === 3) score += 15;
        else if (words.length === 1) score += 2;
        
        // Check capitalization of words
        const allCapitalized = words.every(word => /^[A-Z]/.test(word));
        if (allCapitalized) score += 10;
        
        // Penalize lines that contain any numbers in the original text (e.g. addresses, IDs)
        if (/\d/.test(line)) score -= 15;
        
        // Proximity to date of birth: if near the extracted DOB line, boost it
        if (dob) {
          // Find if this line is close to any date patterns in the text
          for (let offset = -2; offset <= 2; offset++) {
            if (i + offset >= 0 && i + offset < lines.length) {
              const nearbyLine = lines[i + offset];
              if (nearbyLine.includes('/') || nearbyLine.includes('-') || /\d{4}/.test(nearbyLine)) {
                score += 5;
                break;
              }
            }
          }
        }
        
        scoredCandidates.push({ name: formatName(cleanLine), score });
      }
    }
    
    if (scoredCandidates.length > 0) {
      // Sort descending by score
      scoredCandidates.sort((a, b) => b.score - a.score);
      console.log('Generic name candidates:', scoredCandidates);
      name = scoredCandidates[0].name;
    }
  }

  const idNumber = extractIdNumber(text, idType);

  return { dob, name, idNumber };
};
