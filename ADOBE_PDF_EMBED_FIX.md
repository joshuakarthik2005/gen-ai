# Adobe PDF Embed API - Domain Authorization Fix

## Problem
Error: "This application domain (http://localhost:3000) is not authorized to use the provided PDF Embed API Client ID"

## Root Cause
Adobe PDF Embed API restricts each Client ID to specific allowed domains/origins. The origin must match exactly (including protocol and port).

## Solution Steps

### 1. Update Adobe Developer Console (CRITICAL)

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Sign in with your Adobe account
3. Navigate to your project (where you created the PDF Embed API credentials)
4. Click on "PDF Embed API" credential
5. Find the "Allowed Origins" section
6. Add these origins (adjust as needed):
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   https://localhost:3000
   ```
7. If deploying to production, also add your production domain:
   ```
   https://your-production-domain.com
   ```
8. **Save the changes**
9. Wait 1-2 minutes for changes to propagate

### 2. Configure Environment Variable (On Each Machine)

#### On Your Main Laptop:
1. Navigate to `frontend` folder
2. Copy the example env file:
   ```powershell
   Copy-Item .env.local.example .env.local
   ```
3. Edit `.env.local` and set your Adobe Client ID:
   ```
   NEXT_PUBLIC_ADOBE_CLIENT_ID=your_actual_client_id_here
   ```

#### On the Other Laptop:
1. Do the same steps as above
2. Make sure you use the **same Client ID** that you configured in Adobe Console

### 3. Rebuild and Test

#### Development Mode:
```powershell
cd frontend
npm install
npm run dev
```
Then open http://localhost:3000

#### Production Build:
```powershell
cd frontend
npm run build
npm run start
```

### 4. Verify in Browser Console

When you open the app, check the browser console (F12) for these debug messages:
```
🔑 Adobe PDF Embed - Using Client ID: your_client_id
🌐 Current Origin: http://localhost:3000
💡 Make sure this origin is added to Adobe Console allowed domains
```

**Verify:**
- The Client ID matches what you set in Adobe Console
- The Origin matches what you added to "Allowed Origins"

## Common Issues

### Issue: Still getting error after adding domain
**Solution:** 
- Clear browser cache and hard reload (Ctrl+Shift+R)
- Restart the dev server
- Wait 2-3 minutes for Adobe changes to propagate
- Verify the origin is exactly the same (including http:// vs https://)

### Issue: Works on one laptop but not another
**Solution:**
- Make sure both laptops have the same `.env.local` file with the correct Client ID
- Verify both are using the same port (both on :3000)
- Check if one is using http and the other https
- Run `npm run build` on both to ensure using the latest code

### Issue: Different Client ID in console vs code
**Solution:**
- The code now uses environment variable, so check `.env.local` file
- Restart the dev server after changing `.env.local`
- Clear Next.js cache: `Remove-Item -Recurse -Force .next` then rebuild

## Quick Diagnostic Commands

Check current origin in browser console:
```javascript
console.log(window.location.origin)
```

Check which Client ID is being used (should appear automatically on page load now)

## Alternative: Use Wildcard Domain (If Available)

Some Adobe plans allow wildcard domains. If available, you can add:
```
http://localhost:*
```

But this is not always available in free tier.

## For Production Deployment

1. Add your production domain to Adobe Console "Allowed Origins"
2. Set `NEXT_PUBLIC_ADOBE_CLIENT_ID` in your deployment platform's environment variables
3. Deploy and test

---

**Need Help?**
- Adobe Console: https://developer.adobe.com/console
- PDF Embed API Docs: https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/
