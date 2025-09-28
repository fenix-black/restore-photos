# Restore Photos - Next.js Version

AI-powered photo restoration application built with Next.js, featuring secure backend API routes for handling Google Gemini AI model interactions.

## Features

- 🖼️ **Photo Restoration**: AI-powered restoration and colorization of old photographs
- 🎬 **Video Generation**: Create subtle animations from restored photos
- 💳 **Credit System**: Integrated GrowthKit credit management and user accounts
- 🔒 **Secure API**: Backend API routes protect your API keys
- 🌍 **Multilingual**: Support for English and Spanish
- 📱 **Responsive Design**: Beautiful UI that works on all devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Models**: 
  - Google Gemini AI (2.5-flash, image-preview) for analysis and primary image editing
  - Replicate (Kling v2.1) for video generation
  - Replicate (Seedream-4) as fallback for image restoration when Gemini fails
- **Deployment**: Optimized for Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google AI Studio API key (for image analysis and editing)
- Replicate API token (for video generation)

### Installation

1. Clone the repository:
```bash
cd nextjs-restore-photos
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add your API keys to `.env.local`:
```
# Google Gemini API Key (required for image analysis and editing)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key_here

# Replicate API Token (required for video generation)
REPLICATE_API_TOKEN=your_replicate_api_token_here

# Optional: Choose video provider ('replicate' or 'gemini', defaults to 'replicate')
VIDEO_PROVIDER=replicate

# Optional: For efficient Vercel deployment, return video URLs instead of base64
# Set to 'true' for URL-only response (more efficient)
# Leave as 'false' or unset for base64 response (backward compatible)
RETURN_VIDEO_URL=false
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
nextjs-restore-photos/
├── app/
│   ├── api/              # Backend API routes
│   │   ├── analyze-image/
│   │   ├── edit-image/
│   │   ├── generate-video/
│   │   └── translate/
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
├── contexts/            # React contexts (localization)
├── lib/                 # Server-side utilities
├── locales/             # Translation files
├── services/            # Client-side API services
└── types/               # TypeScript type definitions
```

## API Routes

The application uses Next.js API routes to securely handle AI model interactions:

- `POST /api/analyze-image` - Analyzes uploaded photos (Google Gemini)
- `POST /api/edit-image` - Edits/restores images (Google Gemini)
- `POST /api/translate` - Translates text (Google Gemini)
- `POST /api/generate-video` - Generates videos from images (Replicate Kling v2.1 or Google Veo)

## Key Improvements Over React Version

1. **Security**: API keys are now stored server-side and never exposed to the client
2. **Performance**: Server-side processing reduces client load
3. **SEO**: Better SEO with Next.js server-side rendering capabilities
4. **Scalability**: Ready for deployment on Vercel with automatic scaling
5. **Error Handling**: Improved error handling with proper API responses

## Environment Variables

### Required
- `GOOGLE_GENAI_API_KEY` - Your Google AI Studio API key (for image analysis and editing)
- `REPLICATE_API_TOKEN` - Your Replicate API token (for video generation with Kling v2.1)
- `GROWTHKIT_API_KEY` - Your GrowthKit server-side API key (for credit management)
- `NEXT_PUBLIC_GROWTHKIT_API_KEY` - Your GrowthKit public API key (for client-side SDK)

### Optional
- `VIDEO_PROVIDER` - Choose between 'replicate' (default) or 'gemini' for video generation
- `RETURN_VIDEO_URL` - Set to 'true' to return video URLs instead of base64 (recommended for Vercel)
- `USE_REPLICATE_FALLBACK` - Set to 'false' to disable Replicate fallback for image restoration (defaults to 'true')
- `NEXT_PUBLIC_APP_URL` - Public URL of your app (defaults to http://localhost:3000)
- `GROWTHKIT_API_URL` - GrowthKit API URL (defaults to https://growth.fenixblack.ai/api)
- `NEXT_PUBLIC_GROWTHKIT_SERVER_URL` - GrowthKit server URL for client SDK (defaults to https://growth.fenixblack.ai)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Google Cloud Run
- Docker containers

## Credit System

The app uses GrowthKit for credit management:

### Credit Costs
- **Photo Restoration**: 1 credit per photo restoration
- **Video Generation**: 2 credits per video generated

### User Features
- Credit balance display in account widget
- Earn credits through referrals and other actions
- Account management and profile completion
- Automatic referral tracking and rewards

## API Limits and Considerations

- Maximum file size: 50MB (configurable in `next.config.mjs`)
- Video generation timeout: 5 minutes
- Rate limiting: Implement as needed based on your API quotas and credit system

## Contributing

Feel free to submit issues and pull requests.

## License

MIT

## Getting API Keys

### Google AI Studio
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env.local` file

### Replicate
1. Sign up at [Replicate](https://replicate.com)
2. Go to [Account Settings](https://replicate.com/account/api-tokens)
3. Create a new API token
4. Add it to your `.env.local` file

## Video Generation Notes

### Using Replicate (Recommended)
The app now uses Replicate's Kling v2.1 model for video generation by default. This model:
- Generates 5-second videos from a single image
- Supports cinematic prompts with subtle, natural movements
- Works well with the restoration workflow

### Vercel Deployment Optimization
When deploying to Vercel, consider setting `RETURN_VIDEO_URL=true` to:
- Avoid large base64 payloads
- Reduce serverless function response size
- Improve performance and reduce costs

Note: If using URL mode, ensure your frontend can handle video URLs instead of base64 data.

## Image Restoration Reliability

The app now includes a robust fallback system for image restoration:

### Primary Method: Google Gemini
- Uses Google's Gemini 2.5-flash image-preview model
- Provides high-quality restoration and colorization
- Handles complex restoration prompts effectively

### Fallback Method: Replicate Seedream-4
- Automatically activated when Gemini fails (500 errors, rate limits, etc.)
- Uses Bytedance's Seedream-4 model for image enhancement
- Provides reliable backup restoration capabilities
- Can be disabled by setting `USE_REPLICATE_FALLBACK=false`

### How It Works
1. **Primary Attempt**: Google Gemini processes the restoration
2. **Fallback Trigger**: If Gemini fails with any error, Replicate is tried
3. **Requirements Check**: Fallback only works if `REPLICATE_API_TOKEN` is configured
4. **Error Handling**: If both fail, detailed error messages are provided

This ensures maximum uptime and reliability for your photo restoration service.

## Credits

Built with ❤️ using Next.js, Google Gemini AI, and Replicate