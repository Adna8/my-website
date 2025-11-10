# Smart Shelf

Smart Shelf is a modern library assistant built with React + Vite. It offers:

- AI-powered search (configurable backend)
- Voice recognition for Arabic and English
- Interactive shelf map
- User authentication and chat with persistence via Supabase

## Development

Prerequisites: Node.js and npm.

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

## Build & Preview

```sh
npm run build
npm run preview
```

## Configuration

- Supabase: set your environment variables in .env (URL and anon key)
- Voice-to-text: configure your function credentials if you use external providers
- Chat backend: the default function streams a placeholder response. Replace it with your preferred AI provider if needed.

## Technologies

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Assets

- Favicon and social images should use the Smart Shelf logo.

## License

MIT
