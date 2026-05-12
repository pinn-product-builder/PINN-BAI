import { useMemo, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { type ArgutoClient, SIGNAL_STYLE } from '@/data/arguto-demo';

interface Props {
  clients: ArgutoClient[];
  /** Quantos pontos (top por receita esperada) ligar com a linha da rota */
  routeTop?: number;
}

const MAP_ID = 'pinn-bai-arguto';

const fmtBRL = (v: number) =>
  v >= 1_000 ? `R$ ${(v / 1_000).toFixed(1)}K` : `R$ ${v.toLocaleString('pt-BR')}`;

export default function ArgutoMap({ clients, routeTop = 5 }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  if (!apiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted/30 text-center p-6">
        <p className="text-xs text-muted-foreground">
          <strong>Mapa indisponível.</strong>
          <br />
          Defina <code className="px-1 py-0.5 rounded bg-muted">VITE_GOOGLE_MAPS_API_KEY</code> no <code>.env</code>.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['marker']}>
      <Map
        mapId={MAP_ID}
        defaultCenter={{ lat: -18.93, lng: -47.95 }}
        defaultZoom={8}
        gestureHandling="cooperative"
        disableDefaultUI={false}
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <RouteLine clients={clients.slice(0, routeTop)} />
        <Markers clients={clients} />
      </Map>
    </APIProvider>
  );
}

/* ──────────── Markers ──────────── */

function Markers({ clients }: { clients: ArgutoClient[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <>
      {clients.map((c) => {
        const style = SIGNAL_STYLE[c.sinal];
        const size = 12 + Math.min(20, c.receitaEsperada / 1200);
        return (
          <AdvancedMarker
            key={c.id}
            position={{ lat: c.lat, lng: c.lng }}
            onClick={() => setActiveId(c.id)}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: style.fg,
                border: '2px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
              title={c.cliente}
            />
          </AdvancedMarker>
        );
      })}

      {activeId &&
        (() => {
          const c = clients.find((x) => x.id === activeId);
          if (!c) return null;
          const style = SIGNAL_STYLE[c.sinal];
          return (
            <InfoWindow
              position={{ lat: c.lat, lng: c.lng }}
              onCloseClick={() => setActiveId(null)}
              pixelOffset={[0, -16]}
            >
              <div style={{ minWidth: 180 }}>
                <p style={{ fontWeight: 600, fontSize: 13, margin: 0, color: '#1A1A1A' }}>
                  {c.cliente}
                </p>
                <p style={{ fontSize: 11, color: '#555', margin: '2px 0' }}>{c.cidade}</p>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: style.bg,
                    color: style.fg,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    margin: '4px 0',
                  }}
                >
                  {style.label}
                </div>
                <p style={{ fontSize: 11, margin: '4px 0 0 0', color: '#1A1A1A' }}>
                  <strong>{fmtBRL(c.receitaEsperada)}</strong>{' '}
                  <span style={{ color: '#555' }}>· {c.probConversao}% prob</span>
                </p>
                <p style={{ fontSize: 10, margin: '4px 0 0 0', color: '#555', fontStyle: 'italic' }}>
                  {c.acaoRecomendada}
                </p>
              </div>
            </InfoWindow>
          );
        })()}
    </>
  );
}

/* ──────────── Polyline ligando os top-N ──────────── */

function RouteLine({ clients }: { clients: ArgutoClient[] }) {
  const map = useMap();

  useMemo(() => {
    if (!map || clients.length < 2) return;
    const polyline = new google.maps.Polyline({
      path: clients.map((c) => ({ lat: c.lat, lng: c.lng })),
      geodesic: true,
      strokeColor: '#FF6B35',
      strokeOpacity: 0.0, // usamos icons pra simular dashed
      strokeWeight: 0,
      icons: [
        {
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.8,
            strokeColor: '#FF6B35',
            scale: 3,
          },
          offset: '0',
          repeat: '14px',
        },
      ],
    });
    polyline.setMap(map);
    return () => polyline.setMap(null);
  }, [map, clients]);

  return null;
}
