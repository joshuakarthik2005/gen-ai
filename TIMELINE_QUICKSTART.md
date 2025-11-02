# Quick Start: Obligation Timeline Feature

## For Users

### How to Use the Timeline Feature

1. **Upload a Legal Document**
   - Go to the main page
   - Upload a PDF contract or agreement
   - Wait for document analysis to complete

2. **Access the Timeline**
   - Look for the blue **"Timeline"** button (📅 icon) in the analysis panel
   - Click it to open the Obligation Timeline view

3. **View Your Obligations**
   - See all obligations displayed in chronological order
   - Switch between **Timeline View** and **List View**
   - Use filters to focus on specific priorities or types

4. **Explore Details**
   - Click any obligation to see full details
   - Review consequences, responsible parties, and deadlines
   - Understand the context from the original document

5. **Export to Calendar**
   - Click **"Export to Calendar"** button
   - Download the .ics file
   - Import into Google Calendar, Outlook, or Apple Calendar

---

## For Developers

### Setup

1. **Backend Setup**
   ```powershell
   cd backend
   
   # Install any missing dependencies (if needed)
   pip install -r requirements.txt
   
   # The obligation_tracker.py module is already integrated
   ```

2. **Frontend Setup**
   ```powershell
   cd frontend
   
   # Dependencies should already be installed
   # If not:
   npm install
   ```

### Testing the Feature

#### Test Backend Endpoint

```powershell
# Start the backend server
cd backend
python api.py
```

Then in another terminal:

```powershell
# Test the endpoint
$token = "your-auth-token"
$body = @{
    document_text = "The Employee shall provide written notice at least 30 days before termination. Payment is due within 15 days of invoice. Annual performance reviews must be conducted each January."
    document_name = "Test Agreement"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:8000/extract-obligations" -Method Post -Body $body -Headers $headers
```

Expected response:
```json
{
  "obligations": [
    {
      "action": "Employee shall provide written notice at least 30 days before termination",
      "responsible_party": "Employee",
      "deadline": "30 days before termination",
      "priority": "high",
      "type": "termination"
    }
  ],
  "summary": {
    "total": 3,
    "upcoming_count": 2
  }
}
```

#### Test Frontend Component

```powershell
# Start frontend dev server
cd frontend
npm run dev
```

1. Open http://localhost:3000
2. Login with demo credentials
3. Upload a test document
4. Click the Timeline button
5. Verify obligations are displayed

### Integration Points

#### Adding Timeline to Other Components

```typescript
import ObligationTimeline from './components/ObligationTimeline';

function YourComponent() {
  const [showTimeline, setShowTimeline] = useState(false);
  const [documentText, setDocumentText] = useState("");

  return (
    <>
      <button onClick={() => setShowTimeline(true)}>
        View Timeline
      </button>

      {showTimeline && (
        <ObligationTimeline
          documentText={documentText}
          documentName="Your Document"
          onClose={() => setShowTimeline(false)}
        />
      )}
    </>
  );
}
```

#### Calling the API Directly

```typescript
async function extractObligations(documentText: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/extract-obligations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        document_text: documentText,
        document_name: 'My Document'
      })
    }
  );
  
  return await response.json();
}
```

### Customization Options

#### Backend: Adjust Extraction Logic

Edit `backend/obligation_tracker.py`:

```python
# Add custom obligation patterns
self.risk_patterns[RiskCategory.CUSTOM] = [
    {
        'pattern': r'your custom regex',
        'severity': RiskSeverity.HIGH,
        'type': 'custom'
    }
]

# Modify priority inference
def _infer_priority(self, sentence: str) -> str:
    # Add your custom logic
    if 'urgent' in sentence.lower():
        return ObligationPriority.CRITICAL
    # ... rest of logic
```

#### Frontend: Customize UI

Edit `frontend/app/components/ObligationTimeline.tsx`:

```typescript
// Change color scheme
const getPriorityColor = (priority: string) => {
  return {
    critical: "bg-purple-100 text-purple-800",  // Your colors
    high: "bg-blue-100 text-blue-800",
    // ...
  }[priority];
};

// Add custom filters
const [customFilter, setCustomFilter] = useState("");
```

### Deployment

The feature is automatically included when you deploy:

```powershell
# Deploy backend
cd backend
.\deploy.ps1

# Deploy frontend
cd frontend
.\deploy.ps1
```

### Monitoring

Check logs for extraction performance:

```powershell
# Backend logs
cd backend
python -c "
import logging
logging.basicConfig(level=logging.INFO)
# Run your server
"
```

Look for:
- "AI extracted N obligations"
- "Rule-based extraction found N obligations"
- Extraction time metrics

---

## Common Issues

### Issue: No obligations found

**Solution:**
- Ensure document contains obligation keywords ("shall", "must", "will")
- Try documents with clear deadlines
- Check that document text was properly extracted

### Issue: Timeline button disabled

**Solution:**
- Wait for document analysis to complete
- Verify `documentText` state is populated
- Check browser console for errors

### Issue: Export not working

**Solution:**
- Check browser allows downloads
- Verify timeline has events to export
- Try different browser if needed

---

## Best Practices

### For Better Extraction

1. **Use Clear Contracts**: Well-structured documents work best
2. **Standard Language**: Documents with "shall", "must", "will" are easier to parse
3. **Explicit Dates**: "January 15, 2025" better than "soon"
4. **Section Headers**: Helps with context extraction

### For Performance

1. **Limit Document Size**: Under 50 pages recommended
2. **Cache Results**: Store extracted obligations to avoid re-extraction
3. **Async Processing**: For large documents, consider background processing

### For User Experience

1. **Show Progress**: Display loading state during extraction
2. **Error Handling**: Gracefully handle extraction failures
3. **Export Options**: Offer multiple export formats
4. **Mobile Responsive**: Ensure timeline works on all devices

---

## Support

For issues or questions:
1. Check the main README.md
2. Review OBLIGATION_TIMELINE_FEATURE.md
3. Check backend logs for API errors
4. Review browser console for frontend errors

---

**Quick Reference:**

| Feature | Location |
|---------|----------|
| Backend API | `backend/api.py` - `/extract-obligations` |
| Extraction Logic | `backend/obligation_tracker.py` |
| Frontend Component | `frontend/app/components/ObligationTimeline.tsx` |
| Integration | `frontend/app/components/DocumentDashboard.tsx` |
| Documentation | `OBLIGATION_TIMELINE_FEATURE.md` |
