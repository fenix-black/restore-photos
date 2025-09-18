# Async Video Generation Setup

## Overview
This implementation adds async video generation support to avoid Vercel timeout issues for long-running video generation tasks (up to 10 minutes).

## How It Works
1. **Start Generation**: Returns a prediction ID immediately (takes ~2 seconds)
2. **Polling**: Frontend polls every 5 seconds to check status
3. **Completion**: When ready, the video URL is fetched and displayed

## Configuration

### Environment Variables
Add these to your `.env.local` file or Vercel environment settings:

```bash
# Enable async video generation (required for videos > 5 minutes)
USE_ASYNC_VIDEO=true

# Your existing Replicate API token
REPLICATE_API_TOKEN=your_token_here

# Optional: Keep existing provider settings
VIDEO_PROVIDER=replicate
```

## Deployment
1. Commit and push changes
2. Set `USE_ASYNC_VIDEO=true` in Vercel environment variables
3. Deploy to Vercel

## Benefits
- ✅ Handles 10+ minute video generation without timeout
- ✅ Function execution time reduced from 300s to 10s
- ✅ Better user experience with progress updates
- ✅ More cost-effective (shorter function execution)
- ✅ Backward compatible (can disable with `USE_ASYNC_VIDEO=false`)

## Technical Details
- **Minimal changes**: Only 3 files modified
- **Same UI**: Progress messages continue to work
- **Same models**: Uses existing `minimax/hailuo-02` model
- **Polling interval**: 5 seconds (120 attempts = 10 minutes max)

## Troubleshooting
- If videos fail, check Replicate dashboard for prediction status
- Ensure `REPLICATE_API_TOKEN` is correctly set
- Check browser console for polling status updates
