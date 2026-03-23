import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top left, rgba(34,211,238,0.35), transparent 28%), linear-gradient(135deg, #08111f, #0f172a 55%, #1f2937)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 72,
            border: '2px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 40px 120px rgba(34,211,238,0.22)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.9), rgba(8,17,31,0.95))',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', gap: 18 }}>
              <div style={{ width: 92, height: 92, borderRadius: 26, background: '#22d3ee' }} />
              <div
                style={{
                  width: 138,
                  height: 92,
                  borderRadius: 26,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              <div
                style={{
                  width: 178,
                  height: 128,
                  borderRadius: 30,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />
              <div style={{ width: 52, height: 128, borderRadius: 24, background: '#fb923c' }} />
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
