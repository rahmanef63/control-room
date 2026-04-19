import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 32,
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(34,211,238,0.22)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.9), rgba(8,17,31,0.95))',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#22d3ee' }} />
              <div
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  width: 64,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />
              <div style={{ width: 18, height: 42, borderRadius: 9, background: '#fb923c' }} />
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
