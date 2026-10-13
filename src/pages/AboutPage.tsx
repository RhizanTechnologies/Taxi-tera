import { useNavigate } from 'react-router-dom';

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--clr-soft2)', overflowY: 'auto' }}>
      <div className="app-header">
        <button className="btn btn-ghost" style={{ minWidth: 44, padding: '0 8px' }} onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">About Taxi Tera</span>
      </div>
      <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>What is Taxi Tera?</h2>
          <p className="text-sm" style={{ lineHeight: 1.65 }}>
            Taxi Tera (ታክሲ ተራ) is a community-built map of minibus taxi stations in Addis Ababa. Anyone can add a station from the field. Every entry is reviewed by an admin before it appears on the map — so the data is reliable.
          </p>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>How data is collected</h2>
          <p className="text-sm" style={{ lineHeight: 1.65 }}>
            Contributors go to a station in person. The app captures their GPS location, a photo of the queue spot, the station name in Amharic and English, and the fares to each destination. The admin reviews and approves before anything is public.
          </p>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>Map data</h2>
          <p className="text-sm" style={{ lineHeight: 1.65 }}>
            The base map uses <strong>OpenStreetMap</strong> tiles. © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: 'var(--clr-primary)' }}>OpenStreetMap contributors</a>. Station and fare data is collected independently and is not copied from other services.
          </p>
        </div>
      </div>
    </div>
  );
}
