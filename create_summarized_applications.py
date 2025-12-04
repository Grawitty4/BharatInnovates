#!/usr/bin/env python3
"""
Script to create summarized application data for the 383 shortlisted applications.
Generates a new JSON file with:
- About (concise description < 100 words, split into 2 paragraphs if needed)
- Traction and Achievements:
  - Funding/Grants (1 line)
  - Patents & IP (1 line)
  - Awards and Achievements (1 line)
  - Team summary (1 line with credentials)
- Media Coverage (1 line with hyperlinks)
- Team members (as separate cards)
"""

import json
import re
from typing import Dict, List, Any

def count_words(text: str) -> int:
    """Count words in text"""
    if not text or text == 'nan':
        return 0
    return len(text.split())

def format_funding_summary(app: Dict) -> str:
    """Create 1-line funding/grant summary"""
    parts = []
    
    funded = app.get('Are you funded by any VC/Angel/Govt?', '')
    total_funding = app.get('Total Funding Raised', 0)
    grants = app.get('Have you received any grants or institutional support?', '')
    total_grants = app.get('Total Amount Received', 0)
    fund_source = app.get('Fund Source', '')
    lead_investors = app.get('Lead Investors', '')
    
    if funded and str(funded).lower() == 'yes' and total_funding:
        funding_str = f"₹{total_funding:,.0f}" if isinstance(total_funding, (int, float)) else str(total_funding)
        funding_text = f"Raised {funding_str} in funding"
        if lead_investors:
            funding_text += f" from {lead_investors}"
        parts.append(funding_text)
    
    if grants and str(grants).lower() == 'yes' and total_grants:
        grants_str = f"₹{total_grants:,.0f}" if isinstance(total_grants, (int, float)) else str(total_grants)
        grant_text = f"Received {grants_str} in grants"
        if fund_source:
            grant_text += f" from {fund_source}"
        if parts:
            parts.append(grant_text)
        else:
            parts.append(grant_text)
    
    if not parts:
        return "No funding or grants reported"
    
    return ". ".join(parts) + "."

def format_patents_summary(app: Dict) -> str:
    """Create 1-line patents & IP summary"""
    ip_status = app.get('Intellectual Property Status', '')
    patent_details = app.get('Patent Details', '')
    
    # Extract number of patents from patent_details
    patent_count = 0
    if patent_details:
        # Look for patterns like "18 patents", "3 patents", "patent no", etc.
        numbers = re.findall(r'(\d+)\s*patent', patent_details.lower())
        if numbers:
            patent_count = int(numbers[0])
        elif 'patent' in patent_details.lower():
            # Count "patent" mentions
            patent_count = patent_details.lower().count('patent')
    
    parts = []
    if ip_status:
        parts.append(ip_status)
    
    if patent_count > 0:
        parts.append(f"{patent_count} patent{'s' if patent_count > 1 else ''} granted")
    elif patent_details:
        # Extract first part of patent details
        first_sentence = patent_details.split('.')[0][:100]
        parts.append(first_sentence)
    
    if not parts:
        return "No patent information available"
    
    return ". ".join(parts) + "."

def format_awards_summary(app: Dict) -> str:
    """Create 1-line awards summary"""
    awards = app.get('awards', [])
    
    if not awards:
        return "No awards reported"
    
    # Count valid awards
    valid_awards = [a for a in awards if a.get('Award/Recognition') and str(a.get('Award/Recognition')).strip() and str(a.get('Award/Recognition')).lower() != 'nan']
    count = len(valid_awards)
    
    if count == 0:
        return "No awards reported"
    
    if count == 1:
        award_name = valid_awards[0].get('Award/Recognition', '')
        awarding_body = valid_awards[0].get('Awarding Body', '')
        year = valid_awards[0].get('Year', '')
        
        parts = [f"Received {award_name}"]
        if awarding_body:
            parts.append(f"from {awarding_body}")
        if year and str(year).lower() != 'invalid date' and str(year) != 'nan':
            parts.append(f"in {year}")
        return ". ".join(parts) + "."
    else:
        return f"Received {count} awards and recognitions."

def format_team_summary(app: Dict) -> str:
    """Create 1-line team summary with credentials"""
    team_size = app.get('Team Size (full-time equivalents)', 0)
    team_capacity = app.get('Team Capacity', '')
    team_members = app.get('team_members', [])
    
    parts = []
    
    # Team size
    if team_size:
        parts.append(f"Team of {int(team_size)} members")
    elif team_members:
        parts.append(f"Team of {len(team_members)} members")
    
    # Extract credentials from Team Capacity
    credentials = []
    if team_capacity:
        # Look for IIT, IIM, ex-Google, ex-Amazon, etc.
        text_lower = team_capacity.lower()
        if 'iit' in text_lower:
            iit_count = text_lower.count('iit')
            credentials.append(f"{iit_count} IIT alumni")
        if 'iim' in text_lower:
            iim_count = text_lower.count('iim')
            credentials.append(f"{iim_count} IIM alumni")
        if 'ex-google' in text_lower or 'former google' in text_lower:
            credentials.append("ex-Google")
        if 'ex-amazon' in text_lower or 'former amazon' in text_lower:
            credentials.append("ex-Amazon")
        if 'ex-microsoft' in text_lower or 'former microsoft' in text_lower:
            credentials.append("ex-Microsoft")
        if 'phd' in text_lower:
            credentials.append("PhD holders")
    
    # Also check team members for credentials
    if team_members:
        for member in team_members:
            role = str(member.get('Role', '')).lower()
            email = str(member.get('Email', '')).lower()
            # Check email domains for company affiliations
            if '@iit' in email or 'iit' in role:
                if 'iit' not in ' '.join(credentials).lower():
                    credentials.append("IIT alumni")
            if '@iim' in email or 'iim' in role:
                if 'iim' not in ' '.join(credentials).lower():
                    credentials.append("IIM alumni")
    
    if credentials:
        parts.append("including " + ", ".join(credentials))
    
    if not parts:
        return "Team information not available"
    
    return ", ".join(parts) + "."

def format_media_coverage(app: Dict) -> List[Dict]:
    """Format media coverage with hyperlinks"""
    media_items = app.get('media_coverage', [])
    
    formatted = []
    for media in media_items:
        media_type = media.get('Type', '')
        website_link = media.get('Website links', '')
        details = media.get('Details', '')
        year = media.get('Year', '')
        
        if not website_link or str(website_link).strip() == '' or str(website_link).lower() == 'nan':
            continue
        
        # Create description (without type, as type will be shown separately as header)
        desc_parts = []
        if details:
            desc_parts.append(details[:100])
        if year and str(year).lower() != 'invalid date' and str(year) != 'nan':
            desc_parts.append(f"({year})")
        
        description = " - ".join(desc_parts) if desc_parts else "Media coverage"
        
        formatted.append({
            "type": media_type if media_type else "Media Coverage",
            "description": description,
            "link": website_link
        })
    
    return formatted

def clean_text(text: str) -> str:
    """Clean and professionalize text by removing academic phrases and improving flow"""
    if not text:
        return text
    
    # Remove common academic phrases at the start
    academic_starters = [
        r'^herein[,:]?\s*',
        r'^we propose\s+',
        r'^we present\s+',
        r'^we develop\s+',
        r'^we introduce\s+',
        r'^this paper\s+',
        r'^this study\s+',
        r'^this work\s+',
        r'^in this paper[,:]?\s*',
        r'^in this study[,:]?\s*',
        r'^in this work[,:]?\s*',
        r'^the present\s+',
        r'^the current\s+',
    ]
    
    text_lower = text.lower()
    for pattern in academic_starters:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Improve infinitive starters - make them more direct
    infinitive_patterns = [
        (r'^to develop\s+', 'Develops '),
        (r'^to create\s+', 'Creates '),
        (r'^to build\s+', 'Builds '),
        (r'^to design\s+', 'Designs '),
        (r'^to provide\s+', 'Provides '),
        (r'^to offer\s+', 'Offers '),
        (r'^to enable\s+', 'Enables '),
        (r'^to deliver\s+', 'Delivers '),
    ]
    
    for pattern, replacement in infinitive_patterns:
        if re.match(pattern, text, re.IGNORECASE):
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
            break
    
    # Capitalize first letter if needed
    if text:
        text = text[0].upper() + text[1:] if len(text) > 1 else text.upper()
    
    # Fix common issues
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces
    text = re.sub(r'\.{2,}', '.', text)  # Multiple periods
    text = text.strip()
    
    return text

def create_about_description(app: Dict) -> Dict:
    """Create About section (< 100 words, split into 2 paragraphs if needed)"""
    problem = str(app.get('Problem Clarity', '') or '').strip()
    solution = str(app.get('Solution Strength', '') or '').strip()
    innovation = str(app.get('Innovation/Originality', '') or '').strip()
    impact = str(app.get('Impact Potential', '') or '').strip()
    
    # Combine into description
    description_parts = []
    
    # Start with solution (what it is) - cleaned and professionalized
    if solution and solution != 'nan':
        sentences = [s.strip() for s in solution.split('.') if s.strip() and len(s.strip()) > 20]
        if sentences:
            cleaned_solution = clean_text(sentences[0])
            if cleaned_solution:
                description_parts.append(cleaned_solution)
    
    # Add problem context
    if problem and problem != 'nan':
        sentences = [s.strip() for s in problem.split('.') if s.strip() and len(s.strip()) > 20]
        if sentences:
            problem_desc = sentences[0]
            # Clean the problem description
            problem_desc = clean_text(problem_desc)
            if problem_desc:
                if len(problem_desc) > 120:
                    problem_desc = problem_desc[:117] + '...'
                # Make it flow better
                if not problem_desc.lower().startswith('addresses'):
                    description_parts.append(f"Addresses the challenge of {problem_desc.lower()}")
                else:
                    description_parts.append(problem_desc)
    
    # Add innovation if space allows
    if innovation and innovation != 'nan' and len(description_parts) < 2:
        sentences = [s.strip() for s in innovation.split('.') if s.strip() and len(s.strip()) > 20]
        if sentences:
            innovation_desc = clean_text(sentences[0])
            if innovation_desc:
                if len(innovation_desc) > 150:
                    innovation_desc = innovation_desc[:147] + '...'
                description_parts.append(innovation_desc)
    
    # Combine
    full_description = '. '.join(description_parts)
    
    # Final cleanup
    full_description = re.sub(r'\.{2,}', '.', full_description)
    full_description = re.sub(r'\s+', ' ', full_description)
    full_description = full_description.strip()
    
    if full_description and not full_description.endswith('.'):
        full_description += '.'
    
    # Check word count
    word_count = count_words(full_description)
    
    # Split into paragraphs if > 50 words
    if word_count > 50:
        # Split at sentence boundary around 50 words
        sentences = [s.strip() for s in full_description.split('.') if s.strip()]
        mid_point = len(sentences) // 2
        
        para1 = '. '.join(sentences[:mid_point])
        para2 = '. '.join(sentences[mid_point:])
        
        if para1 and not para1.endswith('.'):
            para1 += '.'
        if para2 and not para2.endswith('.'):
            para2 += '.'
        
        return {
            "paragraph1": para1,
            "paragraph2": para2,
            "word_count": count_words(para1) + count_words(para2)
        }
    else:
        return {
            "paragraph1": full_description,
            "paragraph2": None,
            "word_count": word_count
        }

def format_team_members(app: Dict) -> List[Dict]:
    """Format team members as separate cards"""
    team_members = app.get('team_members', [])
    
    formatted = []
    for member in team_members:
        name = member.get('Name', '')
        role = member.get('Role', '')
        email = member.get('Email', '')
        mobile = member.get('Mobile Number', '')
        dob = member.get('Date of Birth', '')
        gender = member.get('Gender', '')
        
        # Skip if no name
        if not name or str(name).strip() == '' or str(name).lower() == 'nan':
            continue
        
        # Extract credentials from role/email
        credentials = []
        if email:
            if '@iit' in str(email).lower():
                credentials.append("IIT")
            if '@iim' in str(email).lower():
                credentials.append("IIM")
        
        if role:
            role_lower = str(role).lower()
            if 'iit' in role_lower:
                credentials.append("IIT")
            if 'iim' in role_lower:
                credentials.append("IIM")
            if 'ex-google' in role_lower or 'former google' in role_lower:
                credentials.append("ex-Google")
            if 'ex-amazon' in role_lower or 'former amazon' in role_lower:
                credentials.append("ex-Amazon")
        
        formatted.append({
            "name": name,
            "role": role if role else None,
            "email": email if email else None,
            "mobile": mobile if mobile else None,
            "credentials": ", ".join(set(credentials)) if credentials else None
        })
    
    return formatted

def create_summarized_application(app: Dict) -> Dict:
    """Create summarized version of an application"""
    return {
        "ApplicationId": app.get('ApplicationId'),
        "Innovation Title": app.get('Innovation Title', ''),
        "Company Name": app.get('Startup/Company Popular (Brand) Name (if any)') or app.get('Startup/Company Legal Name', ''),
        "Segment": app.get('Select the primary segment for your innovation: (Select only one)', ''),
        "TRL Level": app.get('Technology Readiness Level (TRL)', ''),
        
        "About": create_about_description(app),
        
        "Traction and Achievements": {
            "Funding/Grants": format_funding_summary(app),
            "Patents & IP": format_patents_summary(app),
            "Awards and Achievements": format_awards_summary(app),
            "Team": format_team_summary(app)
        },
        
        "Media Coverage": format_media_coverage(app),
        
        "Team Members": format_team_members(app),
        
        # Keep some original fields for reference
        "Original Data": {
            "Website": app.get('Website Link or Link to Social Media Handle'),
            "Demo Video": app.get('Innovation/Product Demo Video'),
            "High Res Video": app.get('Link to high resolution video file'),
            "Presentation Deck": app.get('Presentation Deck (Max 15 slides)'),
            "Patent Documentation": app.get('Patent Documentation'),
            "Publications": app.get('Publications'),
            "Team CVs": app.get('Team CVs (One single PDF)')
        }
    }

def main():
    input_file = 'shortlisted_applications.json'
    output_file = 'shortlisted_applications_summarized.json'
    
    print(f"Loading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        applications = json.load(f)
    
    print(f"Processing {len(applications)} applications...")
    
    summarized = []
    for i, app in enumerate(applications, 1):
        if i % 50 == 0:
            print(f"  Processed {i}/{len(applications)}...")
        
        try:
            summarized_app = create_summarized_application(app)
            summarized.append(summarized_app)
        except Exception as e:
            print(f"  Error processing {app.get('ApplicationId', 'unknown')}: {e}")
            continue
    
    print(f"\nSaving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(summarized, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"✓ Created {output_file} with {len(summarized)} summarized applications")
    
    # Show sample
    if summarized:
        print("\n=== Sample Application (BHAR-006679) ===")
        sample = next((a for a in summarized if a.get('ApplicationId') == 'BHAR-006679'), None)
        if sample:
            print(json.dumps(sample, indent=2, ensure_ascii=False, default=str)[:2000])
            print("...")

if __name__ == "__main__":
    main()

