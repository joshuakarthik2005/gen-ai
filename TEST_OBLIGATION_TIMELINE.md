# 🧪 Testing Obligation Timeline Feature

## Quick Test Guide

### Prerequisites Check

Before testing, ensure you have:
- ✅ Python 3.x installed
- ✅ Node.js and npm installed
- ✅ Google Cloud authentication configured
- ✅ Adobe PDF API key configured (already done: `42dca80537eb431cad94af71101d769d`)

---

## Method 1: Full Stack Test (Recommended)

### Step 1: Set Up Backend Environment

```powershell
# Navigate to backend
cd backend

# Create .env file from example if not exists
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# Install dependencies (if needed)
pip install -r requirements.txt

# Authenticate with Google Cloud
gcloud auth application-default login
gcloud config set project demystifier-ai
```

### Step 2: Start Backend Server

```powershell
# In backend directory
python api.py
```

**Expected output:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Keep this terminal running!

### Step 3: Start Frontend Server

Open a **new PowerShell terminal**:

```powershell
# Navigate to frontend
cd frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

**Expected output:**
```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
✓ Ready in 2.7s
```

### Step 4: Test the Feature

1. **Open browser**: Navigate to `http://localhost:3000`

2. **Login**: Use demo credentials or your account
   - Demo email: `demo@example.com`
   - Demo password: `demo123`

3. **Upload a test document**:
   - Use `backend/sample_employment_agreement.txt` or any contract PDF
   - Wait for analysis to complete (15-30 seconds)

4. **Click Timeline Button**:
   - Look for the blue **"Timeline"** button (📅 icon) in the Analysis Panel
   - Click it to open the Obligation Timeline

5. **Verify Features**:
   - ✅ Loading spinner appears
   - ✅ Obligations are extracted and displayed
   - ✅ Summary stats show (Total, Critical, High, Upcoming)
   - ✅ Timeline view shows obligations chronologically
   - ✅ List view shows all obligations
   - ✅ Filters work (Priority, Type)
   - ✅ Click obligation to see details
   - ✅ Export to calendar works (.ics file downloads)

---

## Method 2: Backend API Test Only

### Test the API Endpoint Directly

```powershell
# 1. Start backend server
cd backend
python api.py
```

In another terminal:

```powershell
# 2. Test the endpoint with curl or PowerShell

# Get authentication token first
$loginBody = @{
    email = "demo@example.com"
    password = "demo123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:8000/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.access_token

# Test extract-obligations endpoint
$testBody = @{
    document_text = @"
EMPLOYMENT AGREEMENT

The Employee shall provide written notice at least 30 days before termination of employment.

Payment of salary is due within 15 days of invoice submission.

The Employer must conduct an annual performance review each January.

Confidential information must be returned within 5 business days upon termination.

The Employee agrees to submit quarterly progress reports by the 15th of each quarter.
"@
    document_name = "Test Employment Agreement"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "http://localhost:8000/extract-obligations" -Method Post -Body $testBody -Headers $headers

# Display results
$response | ConvertTo-Json -Depth 10
```

**Expected response structure:**
```json
{
  "document_name": "Test Employment Agreement",
  "obligations": [
    {
      "action": "Employee shall provide written notice at least 30 days before termination",
      "responsible_party": "Employee",
      "deadline": "30 days before termination",
      "priority": "high",
      "type": "termination",
      "consequences": "May forfeit benefits"
    }
  ],
  "summary": {
    "total": 5,
    "by_priority": {
      "critical": 0,
      "high": 2,
      "medium": 2,
      "low": 1
    },
    "upcoming_count": 2
  }
}
```

---

## Method 3: Frontend Component Test Only

If backend is already running on Cloud Run:

```powershell
cd frontend

# Ensure .env.local has correct backend URL
# NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app

npm run dev
```

Then follow Steps 4-5 from Method 1.

---

## 🎯 What to Test

### Basic Functionality
- [ ] Timeline button appears after document analysis
- [ ] Clicking Timeline opens modal
- [ ] Loading state shows while extracting
- [ ] Obligations display after extraction
- [ ] Close button works

### Timeline View
- [ ] Chronological order (earliest to latest)
- [ ] Color-coded dots (Red=Critical, Orange=High, etc.)
- [ ] Click obligation to see details
- [ ] Scrollable if many obligations

### List View
- [ ] Switch to List View button works
- [ ] All obligations listed
- [ ] Correct icons and colors
- [ ] Click obligation to see details

### Filters
- [ ] Priority filter (All, Critical, High, Medium, Low)
- [ ] Type filter (All, Payment, Delivery, etc.)
- [ ] Filters update display in real-time
- [ ] Combined filters work together

### Detail Modal
- [ ] Shows all obligation details
- [ ] Action, Party, Deadline, Priority, Type
- [ ] Consequences and Context displayed
- [ ] Close button works

### Export to Calendar
- [ ] Export button visible
- [ ] Clicking downloads .ics file
- [ ] File can be imported to Google Calendar/Outlook
- [ ] Events show correct dates and details

### Summary Stats
- [ ] Total count correct
- [ ] Critical count correct
- [ ] High priority count correct
- [ ] Upcoming (30 days) count correct

---

## 🐛 Troubleshooting

### Timeline Button Disabled/Missing

**Problem:** Button is gray or doesn't appear

**Solutions:**
1. Wait for document analysis to complete
2. Check browser console for errors (F12)
3. Verify document text was extracted:
   ```javascript
   // In browser console
   console.log(documentText);
   ```

### No Obligations Found

**Problem:** Empty timeline after extraction

**Possible causes:**
- Document doesn't contain obligation keywords ("shall", "must", "will")
- Document is too informal or unstructured

**Solutions:**
1. Try with a formal contract (employment agreement, service contract)
2. Ensure document has clear obligations with deadlines
3. Check backend logs for extraction errors

### API Authentication Error

**Problem:** "Authentication required" or 401 error

**Solutions:**
```powershell
# Check if token is valid
$token = localStorage.getItem("token")
echo $token

# Re-login if needed
# Go to http://localhost:3000 and login again
```

### Backend Connection Error

**Problem:** "Failed to extract obligations" or network error

**Solutions:**
1. Verify backend is running:
   ```powershell
   # Check if port 8000 is listening
   netstat -ano | findstr :8000
   ```

2. Check NEXT_PUBLIC_API_URL in `frontend/.env.local`:
   - Local: `http://localhost:8000`
   - Cloud Run: `https://legal-backend-144935064473.asia-south1.run.app`

3. Check backend logs for errors

### Google Cloud Authentication Error

**Problem:** Vertex AI or Gemini API errors

**Solutions:**
```powershell
# Re-authenticate
gcloud auth application-default login
gcloud config set project demystifier-ai

# Verify credentials
gcloud auth list
gcloud config get-value project
```

### Adobe PDF Not Loading

**Problem:** PDF viewer shows error

**Solution:**
- Already configured with key: `42dca80537eb431cad94af71101d769d`
- Add your domain to Adobe Console allowed list
- Check browser console for specific Adobe error

---

## 📊 Sample Test Documents

### Good Test Cases

**Employment Agreement:**
```
The Employee shall provide 30 days written notice before resignation.
Salary payment due within 15 days of invoice.
Annual performance review conducted each January.
```

**Service Contract:**
```
Vendor must deliver goods within 10 business days.
Payment due net 30 days from invoice date.
Monthly status reports required by 5th of each month.
Termination requires 60 days written notice.
```

**Lease Agreement:**
```
Rent payment due on 1st of each month.
Security deposit refundable within 30 days of move-out.
Tenant must provide 60 days notice before lease termination.
Annual inspection conducted each December.
```

### Poor Test Cases (Won't work well)

❌ Informal emails
❌ Meeting notes
❌ Marketing content
❌ Documents without dates or deadlines
❌ Very short documents (<100 words)

---

## 📈 Performance Benchmarks

| Metric | Expected Value |
|--------|---------------|
| Extraction time | 5-10 seconds |
| UI render time | <1 second |
| API response size | 50-200 KB |
| Accuracy (structured docs) | 90-95% |
| Max document size | 50 pages |

---

## ✅ Success Checklist

After testing, verify:

- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] Can upload and analyze document
- [ ] Timeline button appears and works
- [ ] Obligations are extracted correctly
- [ ] Timeline view displays properly
- [ ] List view works
- [ ] Filters function correctly
- [ ] Detail modal shows full info
- [ ] Calendar export works
- [ ] Summary stats are accurate
- [ ] Mobile responsive (if applicable)

---

## 🚀 Next Steps After Testing

If all tests pass:

1. **Commit your changes:**
   ```powershell
   git add .
   git commit -m "Add Obligation Timeline feature"
   git push
   ```

2. **Deploy to production:**
   ```powershell
   # Backend
   cd backend
   .\deploy.ps1

   # Frontend
   cd frontend
   .\deploy.ps1
   ```

3. **Test on production URLs**

4. **Monitor logs for errors**

5. **Gather user feedback**

---

## 📞 Need Help?

- Check `OBLIGATION_TIMELINE_FEATURE.md` for full documentation
- Review `TIMELINE_QUICKSTART.md` for quick reference
- Check backend logs: `backend/api.py` console output
- Check frontend logs: Browser console (F12)
- Review `CONFIGURATION_KEYS.md` for setup issues

---

**Happy Testing! 🎉**

*If you find any issues, check the troubleshooting section or review the implementation files.*
