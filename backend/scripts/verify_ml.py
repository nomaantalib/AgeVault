import sys
import json
import os
import re

def clean_string(str_val):
    if not str_val:
        return ""
    return re.sub(r'[^a-z0-9]', '', str_val.lower()).strip()

def extract_dob(text):
    # Match DD/MM/YYYY or DD-MM-YYYY
    dob_match = re.search(r'\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b', text)
    if dob_match:
        return f"{dob_match.group(3)}-{dob_match.group(2)}-{dob_match.group(1)}"
    
    # Match YYYY-MM-DD
    ymd_match = re.search(r'\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b', text)
    if ymd_match:
        return ymd_match.group(0)
    
    # Match Year of Birth fallback
    yob_match = re.search(r'(?:Year of Birth|YOB|Birth|Year)\s*:\s*(\d{4})', text, re.IGNORECASE)
    if yob_match:
        return f"{yob_match.group(1)}-01-01"
        
    return ""

def extract_id_number(text, id_type):
    if not text:
        return ""
    clean_text = text.upper()
    
    # 1. Aadhaar Card (12 digits, often formatted as xxxx xxxx xxxx or xxxxxxxxxxxx)
    if id_type == 'aadhaar':
        aadhaar_match = re.search(r'\b\d{4}\s\d{4}\s\d{4}\b', text) or re.search(r'\b\d{12}\b', text)
        if aadhaar_match:
            return aadhaar_match.group(0).strip()
            
    # 2. PAN Card (10 alphanumeric characters: 5 letters, 4 digits, 1 letter)
    elif id_type == 'pan':
        pan_match = re.search(r'\b[A-Z]{5}\d{4}[A-Z]\b', clean_text)
        if pan_match:
            return pan_match.group(0)
            
    # 3. Passport (Typically a letter followed by 7 digits, or 8-9 alphanumeric characters)
    elif id_type == 'passport':
        passport_match = re.search(r'\b[A-Z]\d{7}\b', clean_text) or re.search(r'\b[A-Z0-9]{8,9}\b', clean_text)
        if passport_match:
            return passport_match.group(0)
            
    # 4. Driver's License (Alphanumeric DL format)
    elif id_type == 'license':
        dl_match = re.search(r'\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7}\b', clean_text) or \
                   re.search(r'\b[A-Z]{2}\d{13}\b', clean_text) or \
                   re.search(r'\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b', clean_text)
        if dl_match:
            return dl_match.group(0)
            
    # Generic fallback
    generic_pan = re.search(r'\b[A-Z]{5}\d{4}[A-Z]\b', clean_text)
    if generic_pan:
        return generic_pan.group(0)
        
    generic_aadhaar = re.search(r'\b\d{4}\s\d{4}\s\d{4}\b', text) or re.search(r'\b\d{12}\b', text)
    if generic_aadhaar:
        return generic_aadhaar.group(0)
        
    generic_passport = re.search(r'\b[A-Z]\d{7}\b', clean_text)
    if generic_passport:
        return generic_passport.group(0)
        
    return ""

def extract_name(text_lines):
    # Aadhaar/DL/PAN name extraction rules
    name_found = ""
    lines = [l.strip() for l in text_lines if l.strip()]
    
    for i, line in enumerate(lines):
        clean_line = line.lower()
        if "dob" in clean_line or "birth" in clean_line or "yob" in clean_line or "male" in clean_line or "female" in clean_line:
            if i > 0:
                candidate = re.sub(r'[^a-zA-Z\s]', '', lines[i-1]).strip()
                if len(candidate) > 3 and "government" not in candidate.lower() and "unique" not in candidate.lower():
                    name_found = candidate
                    break
                    
    if not name_found:
        # PAN Card fallback: Name is usually the first capital-letter line after income tax
        generic_words = ['income', 'tax', 'department', 'govt', 'india', 'permanent', 'account', 'number', 'card', 'father', 'signature']
        for line in lines:
            clean_line = line.lower()
            is_generic = any(w in clean_line for w in generic_words)
            if not is_generic and len(re.sub(r'[^a-zA-Z]', '', line)) > 5:
                if re.match(r'^[A-Z\s\.]+$', line.strip()):
                    name_found = line.strip()
                    break
                    
    if not name_found:
        # DL fallback: Look for "Name" or "FN"
        for i, line in enumerate(lines):
            clean_line = line.lower()
            if "name" in clean_line or "fn" in clean_line or "ln" in clean_line:
                match = re.sub(r'^(?:name|fn|ln|full name)\s*[\:\-\=]?\s*', '', line, flags=re.IGNORECASE)
                match = re.sub(r'[^a-zA-Z\s]', '', match).strip()
                if len(match) > 3:
                    name_found = match
                    break
                elif i < len(lines) - 1:
                    candidate = re.sub(r'[^a-zA-Z\s]', '', lines[i+1]).strip()
                    if len(candidate) > 3 and "licence" not in candidate.lower() and "address" not in candidate.lower():
                        name_found = candidate
                        break
                        
    return name_found

def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python verify_ml.py <id_card_path> <selfie_path>"
        }))
        sys.exit(1)
        
    id_card_path = sys.argv[1]
    selfie_path = sys.argv[2]
    id_type = sys.argv[3] if len(sys.argv) > 3 else "aadhaar"
    
    if not os.path.exists(id_card_path) or not os.path.exists(selfie_path):
        print(json.dumps({
            "success": False,
            "error": "One or both image paths do not exist."
        }))
        sys.exit(1)
        
    result_payload = {
        "success": True,
        "ocr_text": "",
        "dob": "",
        "name": "",
        "id_number": "",
        "face_match_confidence": 0.0
    }
    
    # 1. RUN PADDLEOCR
    try:
        from paddleocr import PaddleOCR
        # Suppress logging/warnings from paddle
        import logging
        logging.getLogger("ppocr").setLevel(logging.ERROR)
        
        ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        ocr_result = ocr.ocr(id_card_path, cls=True)
        
        texts = []
        if ocr_result and len(ocr_result) > 0:
            for idx in range(len(ocr_result)):
                res = ocr_result[idx]
                if res:
                    for line in res:
                        texts.append(line[1][0])
                        
        ocr_text = "\n".join(texts)
        result_payload["ocr_text"] = ocr_text
        result_payload["dob"] = extract_dob(ocr_text)
        result_payload["name"] = extract_name(texts)
        result_payload["id_number"] = extract_id_number(ocr_text, id_type)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"PaddleOCR processing error: {str(e)}"
        }))
        sys.exit(1)
        
    # 2. RUN DEEPFACE FACE MATCHING
    try:
        from deepface import DeepFace
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' # Suppress TF logs
        
        verify_res = DeepFace.verify(
            img1_path=id_card_path, 
            img2_path=selfie_path, 
            model_name='VGG-Face', 
            enforce_detection=False
        )
        
        distance = verify_res.get("distance", 1.0)
        threshold = verify_res.get("threshold", 0.4)
        
        # Calculate premium confidence score based on official deepface distance
        if distance <= threshold:
            confidence = 60.0 + (1.0 - (distance / threshold)) * 40.0
        else:
            confidence = max(0.0, (1.0 - (distance - threshold) / (1.0 - threshold)) * 60.0)
            
        result_payload["face_match_confidence"] = round(confidence, 1)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"DeepFace processing error: {str(e)}"
        }))
        sys.exit(1)
        
    print(json.dumps(result_payload))

if __name__ == "__main__":
    main()
