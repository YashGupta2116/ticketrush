import { createApp } from '@/app';

const PORT = 4000;

createApp().listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
