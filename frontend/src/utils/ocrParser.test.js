import { parseOcrText } from './ocrParser.js';

const testCases = [
  {
    name: "Aadhaar Card Front (Standard)",
    idType: "aadhaar",
    text: `
      भारत सरकार
      Government of India
      राहुल कुमार
      Rahul Kumar
      DOB: 15/08/1990
      GENDER: MALE
    `,
    expected: { dob: "1990-08-15", name: "Rahul Kumar" }
  },
  {
    name: "Aadhaar Card Front (Alternate order)",
    idType: "aadhaar",
    text: `
      UNIQUE IDENTIFICATION AUTHORITY OF INDIA
      To,
      Amit Singh
      S/O: Suresh Singh
      Year of Birth / YOB: 1985
      MALE
    `,
    expected: { dob: "1985-01-01", name: "Amit Singh" }
  },
  {
    name: "PAN Card Front",
    idType: "pan",
    text: `
      INCOME TAX DEPARTMENT
      GOVT. OF INDIA
      RAHUL KUMAR SHARMA
      SURESH SHARMA
      15/08/1990
      PERMANENT ACCOUNT NUMBER CARD
    `,
    expected: { dob: "1990-08-15", name: "Rahul Kumar Sharma" }
  },
  {
    name: "PAN Card with labels",
    idType: "pan",
    text: `
      INCOME TAX DEPARTMENT
      NAME: AMIT SINGH
      FATHER'S NAME: SURESH SINGH
      DOB: 05-12-1992
    `,
    expected: { dob: "1992-12-05", name: "Amit Singh" }
  },
  {
    name: "Passport with MRZ",
    idType: "passport",
    text: `
      PASSPORT
      REPUBLIC OF INDIA
      SURNAME: SHARMA
      GIVEN NAMES: RAHUL KUMAR
      DATE OF BIRTH: 15/08/1990
      
      P<INDSHARMA<<RAHUL<KUMAR<<<<<<<<<<<<<<<<<<<<
      J1234567<8IND9008154M2612152<<<<<<<<<<<<<<02
    `,
    expected: { dob: "1990-08-15", name: "Rahul Kumar Sharma" }
  },
  {
    name: "Passport without MRZ (cropped)",
    idType: "passport",
    text: `
      PASSPORT
      REPUBLIC OF INDIA
      SURNAME
      SHARMA
      GIVEN NAMES
      RAHUL KUMAR
      DATE OF BIRTH
      15/08/1990
    `,
    expected: { dob: "1990-08-15", name: "Rahul Kumar Sharma" }
  },
  {
    name: "Driver's License",
    idType: "license",
    text: `
      STATE OF CALIFORNIA DRIVER LICENSE
      DL NO: N1234567
      NAME: JOHN DOE
      DOB: 12-25-1988
      ADDRESS: 123 STREET
    `,
    expected: { dob: "1988-12-25", name: "John Doe" }
  },
  {
    name: "Generic / Unknown Document",
    idType: "generic",
    text: `
      MEMBERSHIP CARD
      Name: Rahul Singh
      DOB: 10/11/1996
      ID: 99201920
    `,
    expected: { dob: "1996-11-10", name: "Rahul Singh" }
  }
];

let failed = false;

console.log("=== Running OCR Parser Tests ===\n");

for (const tc of testCases) {
  const result = parseOcrText(tc.text, tc.idType);
  const dobOk = result.dob === tc.expected.dob;
  const nameOk = result.name === tc.expected.name;
  
  if (dobOk && nameOk) {
    console.log(`✅ [PASS] ${tc.name}`);
  } else {
    console.log(`❌ [FAIL] ${tc.name}`);
    console.log(`   Text: ${tc.text.trim().replace(/\n/g, ' \\ ')}`);
    if (!dobOk) console.log(`   Expected DOB: "${tc.expected.dob}", Got: "${result.dob}"`);
    if (!nameOk) console.log(`   Expected Name: "${tc.expected.name}", Got: "${result.name}"`);
    failed = true;
  }
}

console.log("\n================================");
if (failed) {
  console.log("❌ Some tests failed.");
  process.exit(1);
} else {
  console.log("✅ All tests passed successfully!");
}
