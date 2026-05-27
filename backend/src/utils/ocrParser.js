/**
 * OCR Parser utility for AgeVault Backend
 * Extracts Full Name, Date of Birth (DOB), and ID Card Number from raw text.
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
  
  const cleaned = name.replace(/[^a-zA-Z\s]/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 50) return false;
  
  if (/\d/.test(cleaned)) return false;

  const words = cleaned.split(/\s+/);
  if (words.length < 1) return false;

  const lowercaseCleaned = cleaned.toLowerCase();
  const lowercaseRaw = rawLine ? rawLine.toLowerCase() : lowercaseCleaned;

  const hasNameStopWord = NAME_STOP_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowercaseCleaned);
  });
  if (hasNameStopWord) return false;

  const hasLineStopWord = LINE_STOP_WORDS.some(word => {
    return lowercaseRaw.includes(word);
  });
  if (hasLineStopWord) return false;

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
    .replace(/[^a-zA-Z\s\.]/g, '')
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
  const separatorMatch = line.match(/(?:name|holder|fn|ln|nom|prénom|prenom)\s*[:\-\=]\s*(.+)/i);
  if (separatorMatch && separatorMatch[1]) {
    const candidate = separatorMatch[1].replace(/[^a-zA-Z\s]/g, '').trim();
    if (isPlausibleName(candidate, line)) {
      return formatName(candidate);
    }
  }
  
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
const extractDate = (text) => {
  if (!text) return '';

  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  let normalized = text.replace(/(\d{1,4})\s*[\/|\-\.\,_\\\s]+\s*(\d{1,2})\s*[\/|\-\.\,_\\\s]+\s*(\d{1,4})/g, '$1/$2/$3');
  
  const standardDateRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
  const standardMatch = normalized.match(standardDateRegex);
  if (standardMatch) {
    let d = parseInt(standardMatch[1], 10);
    let m = parseInt(standardMatch[2], 10);
    const y = parseInt(standardMatch[3], 10);
    
    if (m > 12 && d <= 12) {
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

  const yobRegex = /(?:year of birth|yob|birth year|birth|year)\s*[:\-\/\=]?\s*(\d{4})\b/i;
  const yobMatch = text.match(yobRegex);
  if (yobMatch) {
    const y = parseInt(yobMatch[1], 10);
    if (y > 1920 && y <= new Date().getFullYear()) {
      return `${y}-01-01`;
    }
  }

  const currentYearFull = new Date().getFullYear();
  const yearPattern = new RegExp(`\\b(19\\d{2}|2[0-${Math.floor(currentYearFull / 10) % 10}][0-9]\\d)\\b`, 'g');
  const years = text.match(yearPattern);
  if (years) {
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
const extractIdNumber = (text, idType) => {
  if (!text) return '';

  const cleanText = text.toUpperCase();

  // 1. Aadhaar Card
  if (idType === 'aadhaar') {
    const aadhaarMatch = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/) || text.match(/\b\d{12}\b/);
    if (aadhaarMatch) {
      return aadhaarMatch[0].trim();
    }
  }

  // 2. PAN Card
  if (idType === 'pan') {
    const panMatch = cleanText.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
    if (panMatch) {
      return panMatch[0];
    }
  }

  // 3. Passport
  if (idType === 'passport') {
    const passportMatch = cleanText.match(/\b[A-Z]\d{7}\b/) || cleanText.match(/\b[A-Z0-9]{8,9}\b/);
    if (passportMatch) {
      return passportMatch[0];
    }
  }

  // 4. Driver's License
  if (idType === 'license') {
    const dlMatch = cleanText.match(/\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7}\b/) || 
                    cleanText.match(/\b[A-Z]{2}\d{13}\b/) || 
                    cleanText.match(/\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b/);
    if (dlMatch) {
      return dlMatch[0];
    }
  }

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
const parseOcrText = (text, idType) => {
  if (!text) return { dob: '', name: '', idNumber: '' };

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let dob = '';
  let name = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('dob') || line.includes('birth') || line.includes('d.o.b') || line.includes('date of') || line.includes('yob')) {
      const foundDate = extractDate(lines[i]);
      if (foundDate) {
        dob = foundDate;
        break;
      }
      if (i < lines.length - 1) {
        const foundDateNext = extractDate(lines[i + 1]);
        if (foundDateNext) {
          dob = foundDateNext;
          break;
        }
      }
    }
  }

  if (!dob) {
    dob = extractDate(text);
  }

  if (idType === 'passport') {
    let mrzLine1 = '';
    let mrzLine2 = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s/g, '').toUpperCase();
      if (line.startsWith('P<') && line.length >= 35) {
        mrzLine1 = line;
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
      try {
        const namePart = mrzLine1.substring(5);
        const nameSegments = namePart.split('<<');
        const surnameRaw = nameSegments[0] || '';
        const givenNamesRaw = nameSegments[1] || '';

        const surname = surnameRaw.replace(/</g, ' ').trim();
        const givenNames = givenNamesRaw.replace(/</g, ' ').trim();

        name = formatName(`${givenNames} ${surname}`);

        if (mrzLine2.length >= 19) {
          const dobPart = mrzLine2.substring(13, 19);
          if (/^\d{6}$/.test(dobPart)) {
            const yy = parseInt(dobPart.substring(0, 2), 10);
            const mm = dobPart.substring(2, 4);
            const dd = dobPart.substring(4, 6);
            const currentYear = new Date().getFullYear();
            const threshold = currentYear % 100;
            const year = yy > threshold ? 1900 + yy : 2000 + yy;
            dob = `${year}-${mm}-${dd}`;
          }
        }
      } catch (err) {
        console.error('Error parsing Passport MRZ:', err);
      }
    }

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

  else if (idType === 'pan') {
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

    if (!name) {
      const uppercaseCandidates = [];
      const PAN_BOILERPLATE = ['INCOME', 'TAX', 'DEPARTMENT', 'GOVT', 'INDIA', 'PERMANENT', 'ACCOUNT', 'NUMBER', 'CARD', 'FATHER', 'SIGNATURE'];
      
      for (const line of lines) {
        if (/^[A-Z\s\.]+$/.test(line.trim())) {
          const cleanLine = line.trim();
          const isHeader = PAN_BOILERPLATE.some(word => cleanLine.includes(word));
          if (!isHeader && cleanLine.replace(/[^A-Z]/g, '').length > 4) {
            uppercaseCandidates.push(cleanLine);
          }
        }
      }
      
      if (uppercaseCandidates.length > 0) {
        const candidate = uppercaseCandidates[0];
        if (isPlausibleName(candidate, candidate)) {
          name = formatName(candidate);
        }
      }
    }
  }

  else if (idType === 'aadhaar') {
    let dobLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].toLowerCase();
      if (cleanLine.includes('dob') || cleanLine.includes('birth') || cleanLine.includes('yob') || cleanLine.includes('male') || cleanLine.includes('female') || cleanLine.includes('gender')) {
        dobLineIdx = i;
        break;
      }
    }

    if (dobLineIdx !== -1) {
      for (let j = dobLineIdx - 1; j >= Math.max(0, dobLineIdx - 4); j--) {
        const cleanCandidate = lines[j].replace(/[^a-zA-Z\s\.]/g, '').trim();
        if (isPlausibleName(cleanCandidate, lines[j])) {
          if (cleanCandidate.split(/\s+/).length >= 2) {
            name = formatName(cleanCandidate);
            break;
          }
        }
      }

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

  else if (idType === 'license') {
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

  if (!name) {
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
      const cleanLine = line.replace(/[^a-zA-Z\s]/g, '').trim();
      
      if (isPlausibleName(cleanLine, line)) {
        let score = 0;
        const words = cleanLine.split(/\s+/);
        
        if (words.length === 2 || words.length === 3) score += 15;
        else if (words.length === 1) score += 2;
        
        const allCapitalized = words.every(word => /^[A-Z]/.test(word));
        if (allCapitalized) score += 10;
        
        if (/\d/.test(line)) score -= 15;
        
        if (dob) {
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
      scoredCandidates.sort((a, b) => b.score - a.score);
      name = scoredCandidates[0].name;
    }
  }

  const idNumber = extractIdNumber(text, idType);

  return { dob, name, idNumber };
};

module.exports = {
  extractDate,
  extractIdNumber,
  parseOcrText
};
