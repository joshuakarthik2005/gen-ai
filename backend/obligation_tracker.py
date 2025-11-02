"""
Obligation Tracker Module
Extracts deadlines, obligations, and key dates from legal documents
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class ObligationPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ObligationType(str, Enum):
    PAYMENT = "payment"
    DELIVERY = "delivery"
    REPORTING = "reporting"
    TERMINATION = "termination"
    RENEWAL = "renewal"
    COMPLIANCE = "compliance"
    NOTIFICATION = "notification"
    GENERAL = "general"


class ObligationExtractor:
    """
    Extracts obligations, deadlines, and key dates from legal documents
    using AI and rule-based patterns
    """
    
    def __init__(self, model=None):
        """
        Initialize with optional Gemini model
        
        Args:
            model: GenerativeModel instance (optional)
        """
        self.model = model
        self.date_patterns = self._compile_date_patterns()
    
    def _compile_date_patterns(self) -> List[Dict[str, Any]]:
        """
        Compile regex patterns for detecting date references
        """
        return [
            {
                'pattern': r'(?:within|not later than|no later than|by)\s+(\d+)\s+(day|week|month|year)s?',
                'type': 'relative',
                'description': 'Relative deadline'
            },
            {
                'pattern': r'(?:on or before|by|before|no later than)\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})',
                'type': 'absolute',
                'description': 'Absolute date'
            },
            {
                'pattern': r'(?:annual(?:ly)?|yearly)',
                'type': 'recurring',
                'description': 'Annual obligation'
            },
            {
                'pattern': r'(?:quarterly|every\s+quarter)',
                'type': 'recurring',
                'description': 'Quarterly obligation'
            },
            {
                'pattern': r'(?:monthly|every\s+month)',
                'type': 'recurring',
                'description': 'Monthly obligation'
            },
            {
                'pattern': r'(?:upon|following|after)\s+(?:the\s+)?(\w+(?:\s+\w+){0,3})',
                'type': 'conditional',
                'description': 'Event-triggered deadline'
            }
        ]
    
    async def extract_obligations(
        self, 
        document_text: str,
        document_id: str = None,
        document_name: str = "Document"
    ) -> Dict[str, Any]:
        """
        Extract all obligations and deadlines from a document
        
        Args:
            document_text: Full text of the document
            document_id: Optional document identifier
            document_name: Name of the document
        
        Returns:
            Dictionary with obligations, timeline, and summary
        """
        try:
            # Use AI extraction if model available
            if self.model:
                obligations = await self._extract_with_ai(document_text, document_name)
            else:
                obligations = self._extract_with_rules(document_text)
            
            # Sort by priority and deadline
            obligations.sort(key=lambda x: (
                self._priority_weight(x.get('priority', 'low')),
                x.get('deadline_sort_key', datetime.max)
            ), reverse=True)
            
            # Generate timeline events
            timeline_events = self._generate_timeline_events(obligations)
            
            # Create summary statistics
            summary = self._generate_summary(obligations)
            
            return {
                'document_id': document_id,
                'document_name': document_name,
                'obligations': obligations,
                'timeline_events': timeline_events,
                'summary': summary,
                'extracted_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to extract obligations: {str(e)}")
            return {
                'document_id': document_id,
                'document_name': document_name,
                'obligations': [],
                'timeline_events': [],
                'summary': {'total': 0, 'error': str(e)},
                'extracted_at': datetime.utcnow().isoformat()
            }
    
    async def _extract_with_ai(self, document_text: str, document_name: str) -> List[Dict[str, Any]]:
        """
        Use Gemini AI to extract obligations with context understanding
        """
        prompt = f"""
Analyze this legal document and extract ALL obligations, deadlines, and key dates.

Document: {document_name}

For each obligation, identify:
1. **Action**: What must be done (be specific)
2. **Responsible Party**: Who must do it (use exact party names from document)
3. **Deadline**: When it must be done (extract exact date or time period)
4. **Deadline Type**: absolute_date | relative_days | relative_months | recurring | event_triggered | none
5. **Priority**: critical | high | medium | low
6. **Type**: payment | delivery | reporting | termination | renewal | compliance | notification | general
7. **Consequences**: What happens if not done (penalties, termination, etc.)
8. **Context**: Brief surrounding context from the document
9. **Section**: Section number or heading where found

**Special Instructions:**
- Convert relative dates like "30 days after signing" to concrete format
- Flag obligations with severe consequences as "critical" priority
- Include recurring obligations (monthly reports, annual reviews, etc.)
- Extract both explicit obligations ("shall", "must") and implicit ones
- Today's date is {datetime.now().strftime('%B %d, %Y')} - use for relative date calculations

Document Text:
{document_text[:8000]}

Return ONLY a valid JSON array of obligations. Example format:
[
  {{
    "action": "Payment of first installment",
    "responsible_party": "Buyer",
    "deadline": "30 days after signing",
    "deadline_type": "relative_days",
    "deadline_value": 30,
    "priority": "high",
    "type": "payment",
    "consequences": "Late fee of 5% per month",
    "context": "As stated in Section 3.1, payment terms require...",
    "section": "Section 3.1"
  }}
]
"""
        
        try:
            response = self.model.generate_content(prompt)
            
            # Parse JSON from response
            response_text = response.text.strip()
            
            # Extract JSON if wrapped in markdown code blocks
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0].strip()
            
            import json
            obligations = json.loads(response_text)
            
            # Enrich with computed fields
            for obligation in obligations:
                obligation['id'] = f"obl_{hash(obligation.get('action', ''))}"
                obligation['deadline_sort_key'] = self._parse_deadline_for_sort(
                    obligation.get('deadline', ''),
                    obligation.get('deadline_type'),
                    obligation.get('deadline_value')
                )
            
            logger.info(f"AI extracted {len(obligations)} obligations")
            return obligations
            
        except Exception as e:
            logger.error(f"AI extraction failed: {str(e)}")
            # Fallback to rule-based extraction
            return self._extract_with_rules(document_text)
    
    def _extract_with_rules(self, document_text: str) -> List[Dict[str, Any]]:
        """
        Fallback: Rule-based extraction using patterns
        """
        obligations = []
        
        # Split into sentences for analysis
        sentences = re.split(r'[.!?]\s+', document_text)
        
        for idx, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if not sentence or len(sentence) < 20:
                continue
            
            # Check for obligation keywords
            obligation_keywords = ['shall', 'must', 'will', 'required to', 'obligated to', 'agrees to']
            
            if any(keyword in sentence.lower() for keyword in obligation_keywords):
                # Check for date patterns
                deadline_info = self._extract_deadline_from_sentence(sentence)
                
                obligation = {
                    'id': f"obl_{idx}_{hash(sentence[:50])}",
                    'action': self._clean_action_text(sentence),
                    'responsible_party': self._extract_party(sentence),
                    'deadline': deadline_info.get('deadline', 'No specific deadline'),
                    'deadline_type': deadline_info.get('type', 'none'),
                    'deadline_value': deadline_info.get('value'),
                    'priority': self._infer_priority(sentence),
                    'type': self._infer_type(sentence),
                    'consequences': self._extract_consequences(sentence, sentences[idx:idx+3]),
                    'context': sentence[:200],
                    'section': f"Detected at position {idx}",
                    'deadline_sort_key': deadline_info.get('sort_key', datetime.max)
                }
                
                obligations.append(obligation)
        
        logger.info(f"Rule-based extraction found {len(obligations)} obligations")
        return obligations
    
    def _extract_deadline_from_sentence(self, sentence: str) -> Dict[str, Any]:
        """
        Extract deadline information from a sentence
        """
        for pattern_info in self.date_patterns:
            match = re.search(pattern_info['pattern'], sentence, re.IGNORECASE)
            if match:
                deadline_type = pattern_info['type']
                
                if deadline_type == 'relative':
                    value = int(match.group(1))
                    unit = match.group(2).lower()
                    
                    # Calculate approximate future date
                    if unit == 'day':
                        future_date = datetime.now() + timedelta(days=value)
                    elif unit == 'week':
                        future_date = datetime.now() + timedelta(weeks=value)
                    elif unit == 'month':
                        future_date = datetime.now() + timedelta(days=value*30)
                    else:  # year
                        future_date = datetime.now() + timedelta(days=value*365)
                    
                    return {
                        'deadline': match.group(0),
                        'type': 'relative_days' if unit == 'day' else f'relative_{unit}s',
                        'value': value,
                        'sort_key': future_date
                    }
                
                elif deadline_type == 'absolute':
                    return {
                        'deadline': match.group(1),
                        'type': 'absolute_date',
                        'value': None,
                        'sort_key': self._parse_date_string(match.group(1))
                    }
                
                else:  # recurring or conditional
                    return {
                        'deadline': match.group(0),
                        'type': deadline_type,
                        'value': None,
                        'sort_key': datetime.now() + timedelta(days=30)  # Assume near-term
                    }
        
        return {
            'deadline': 'No specific deadline',
            'type': 'none',
            'value': None,
            'sort_key': datetime.max
        }
    
    def _parse_date_string(self, date_str: str) -> datetime:
        """
        Parse date string to datetime object
        """
        try:
            # Try common formats
            for fmt in ['%B %d, %Y', '%B %d %Y', '%m/%d/%Y', '%Y-%m-%d']:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
        except:
            pass
        
        return datetime.max
    
    def _parse_deadline_for_sort(
        self, 
        deadline: str, 
        deadline_type: str, 
        value: Optional[int]
    ) -> datetime:
        """
        Convert deadline to datetime for sorting
        """
        if deadline_type == 'relative_days' and value:
            return datetime.now() + timedelta(days=value)
        elif deadline_type == 'relative_months' and value:
            return datetime.now() + timedelta(days=value*30)
        elif deadline_type == 'absolute_date':
            return self._parse_date_string(deadline)
        elif deadline_type == 'recurring':
            return datetime.now() + timedelta(days=30)
        else:
            return datetime.max
    
    def _clean_action_text(self, text: str) -> str:
        """
        Clean and shorten action text
        """
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        # Limit length
        if len(text) > 150:
            text = text[:147] + '...'
        
        return text
    
    def _extract_party(self, sentence: str) -> str:
        """
        Extract responsible party from sentence
        """
        # Common party identifiers
        parties = [
            'buyer', 'seller', 'vendor', 'client', 'contractor', 
            'company', 'employee', 'employer', 'provider', 'customer',
            'licensee', 'licensor', 'tenant', 'landlord', 'borrower', 'lender'
        ]
        
        sentence_lower = sentence.lower()
        for party in parties:
            if party in sentence_lower:
                return party.title()
        
        return 'Party'
    
    def _infer_priority(self, sentence: str) -> str:
        """
        Infer priority based on keywords
        """
        sentence_lower = sentence.lower()
        
        critical_keywords = ['terminate', 'termination', 'default', 'breach', 'penalty', 'immediately']
        high_keywords = ['payment', 'deliver', 'must', 'critical', 'essential']
        medium_keywords = ['should', 'notify', 'report', 'provide']
        
        if any(kw in sentence_lower for kw in critical_keywords):
            return ObligationPriority.CRITICAL
        elif any(kw in sentence_lower for kw in high_keywords):
            return ObligationPriority.HIGH
        elif any(kw in sentence_lower for kw in medium_keywords):
            return ObligationPriority.MEDIUM
        else:
            return ObligationPriority.LOW
    
    def _infer_type(self, sentence: str) -> str:
        """
        Infer obligation type based on keywords
        """
        sentence_lower = sentence.lower()
        
        type_keywords = {
            ObligationType.PAYMENT: ['pay', 'payment', 'fee', 'invoice', 'compensat'],
            ObligationType.DELIVERY: ['deliver', 'provide', 'supply', 'furnish'],
            ObligationType.REPORTING: ['report', 'notify', 'inform', 'communicate'],
            ObligationType.TERMINATION: ['terminat', 'cancel', 'end', 'cease'],
            ObligationType.RENEWAL: ['renew', 'extend', 'continuation'],
            ObligationType.COMPLIANCE: ['comply', 'adhere', 'conform', 'follow'],
            ObligationType.NOTIFICATION: ['notice', 'notify', 'inform', 'advise']
        }
        
        for obligation_type, keywords in type_keywords.items():
            if any(kw in sentence_lower for kw in keywords):
                return obligation_type
        
        return ObligationType.GENERAL
    
    def _extract_consequences(self, sentence: str, context_sentences: List[str]) -> str:
        """
        Extract consequences of non-compliance
        """
        combined = ' '.join(context_sentences).lower()
        
        consequence_patterns = [
            r'(?:penalty|fine|liquidated damages?).*?(?:\$[\d,]+|[\d]+%)',
            r'(?:may|shall|will)\s+terminat',
            r'(?:breach|default|violation)',
            r'(?:interest|late fee).*?(?:\$[\d,]+|[\d]+%)'
        ]
        
        for pattern in consequence_patterns:
            match = re.search(pattern, combined)
            if match:
                return match.group(0)
        
        return 'Not specified'
    
    def _priority_weight(self, priority: str) -> int:
        """
        Convert priority to numeric weight for sorting
        """
        weights = {
            ObligationPriority.CRITICAL: 4,
            ObligationPriority.HIGH: 3,
            ObligationPriority.MEDIUM: 2,
            ObligationPriority.LOW: 1
        }
        return weights.get(priority, 0)
    
    def _generate_timeline_events(self, obligations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert obligations to timeline events format
        """
        events = []
        
        for obligation in obligations:
            # Skip obligations without concrete deadlines
            if obligation.get('deadline_type') == 'none':
                continue
            
            event = {
                'id': obligation['id'],
                'title': obligation['action'][:80],
                'date': self._format_deadline_for_calendar(obligation),
                'type': obligation.get('type', 'general'),
                'priority': obligation.get('priority', 'low'),
                'responsible_party': obligation.get('responsible_party', 'Unknown'),
                'description': obligation.get('context', '')[:200],
                'consequences': obligation.get('consequences', 'Not specified')
            }
            
            events.append(event)
        
        # Sort by date
        events.sort(key=lambda x: x.get('date', '9999-12-31'))
        
        return events
    
    def _format_deadline_for_calendar(self, obligation: Dict[str, Any]) -> str:
        """
        Format deadline as ISO date string for calendar display
        """
        sort_key = obligation.get('deadline_sort_key')
        
        if sort_key and sort_key != datetime.max:
            return sort_key.strftime('%Y-%m-%d')
        
        # Default to 30 days from now for unspecified
        return (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    
    def _generate_summary(self, obligations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate summary statistics
        """
        if not obligations:
            return {
                'total': 0,
                'by_priority': {},
                'by_type': {},
                'upcoming_count': 0
            }
        
        # Count by priority
        by_priority = {}
        for priority in ObligationPriority:
            by_priority[priority.value] = sum(
                1 for o in obligations if o.get('priority') == priority.value
            )
        
        # Count by type
        by_type = {}
        for obligation_type in ObligationType:
            by_type[obligation_type.value] = sum(
                1 for o in obligations if o.get('type') == obligation_type.value
            )
        
        # Count upcoming (within 30 days)
        now = datetime.now()
        upcoming_count = sum(
            1 for o in obligations 
            if o.get('deadline_sort_key') 
            and o['deadline_sort_key'] != datetime.max
            and o['deadline_sort_key'] < now + timedelta(days=30)
        )
        
        return {
            'total': len(obligations),
            'by_priority': by_priority,
            'by_type': by_type,
            'upcoming_count': upcoming_count
        }
