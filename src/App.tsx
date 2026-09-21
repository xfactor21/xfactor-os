import { Analytics } from '@vercel/analytics/react';
import ChaosDeck from './xfactor/ChaosDeck';

export default function App() {
  return (
    <>
      <ChaosDeck />
      <Analytics />
    </>
  );
}
