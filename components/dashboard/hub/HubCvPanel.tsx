'use client';

import * as React from 'react';
import { hubLoadCvAction } from '@/app/dashboard/hub/actions';
import type { HubCVPayload } from '@/lib/contentful/hub/hubCvTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function HubCvPanel() {
  const [data, setData] = React.useState<HubCVPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await hubLoadCvAction();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el CV');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (busy && !data) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-sm text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Cargando CV…
      </div>
    );
  }

  const cv = data;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-white pb-8 pt-4">
      <div className="flex flex-col gap-4 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Vista general del CV</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Actualizar
        </Button>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!cv?.resumeId ? (
        <p className="text-sm text-neutral-600">No hay entrada publicada de tipo «resume» en HUB.</p>
      ) : (
        <p className="text-xs text-neutral-500">
          Resume ID: <span className="font-mono text-neutral-700">{cv.resumeId}</span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-neutral-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Foto de perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cv?.profileImage?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cv.profileImage.url}
                alt={cv.profileImage.title || 'Profile'}
                className="max-h-48 w-auto max-w-full rounded-md border border-neutral-200 object-contain"
              />
            ) : (
              <p className="text-sm text-neutral-500">Sin imagen</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-neutral-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cv?.contact ? (
              <>
                <p>
                  <span className="text-neutral-500">Email: </span>
                  <span className="font-medium text-neutral-900">{cv.contact.email || '—'}</span>
                </p>
                <Separator />
                <p className="text-neutral-500">Redes</p>
                <ul className="space-y-2">
                  {cv.contact.socialNetworks.length === 0 ? (
                    <li className="text-neutral-500">Sin redes vinculadas</li>
                  ) : (
                    cv.contact.socialNetworks.map((s, i) => (
                      <li key={`social-${s.id}-${i}`} className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2">
                        <div className="font-medium text-neutral-900">{s.platform}</div>
                        <div className="text-xs text-neutral-600">{s.username}</div>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 underline underline-offset-2"
                        >
                          {s.url}
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <p className="text-neutral-500">Sin bloque de contacto</p>
            )}
          </CardContent>
        </Card>
      </div>

      <CvSection title="Experiencia" count={cv?.experience.length ?? 0}>
        {(cv?.experience ?? []).map((x, i) => (
          <div key={`exp-${x.id}-${i}`} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
            <div className="font-medium text-neutral-900">
              {x.roleEn} / {x.roleEs}
            </div>
            <div className="text-neutral-600">
              {x.companyEn} · {x.startDate || '—'} → {x.endDate || '—'}
            </div>
          </div>
        ))}
      </CvSection>

      <CvSection title="Cursos" count={cv?.courses.length ?? 0}>
        {(cv?.courses ?? []).map((c, i) => (
          <div key={`course-${c.id}-${i}`} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
            <div className="font-medium text-neutral-900">{c.titleEn}</div>
            <div className="text-neutral-600">{c.companyEn}</div>
          </div>
        ))}
      </CvSection>

      <CvSection title="Estudios" count={cv?.studies.length ?? 0}>
        {(cv?.studies ?? []).map((s, i) => (
          <div key={`study-${s.id}-${i}`} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
            <div className="font-medium text-neutral-900">{s.titleEn}</div>
            <div className="text-neutral-600">{s.schoolEn}</div>
          </div>
        ))}
      </CvSection>

      <CvSection title="Idiomas" count={cv?.languages.length ?? 0}>
        {(cv?.languages ?? []).map((l, i) => (
          <div key={`lang-${l.id}-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-100 px-3 py-2 text-sm">
            <span className="font-medium text-neutral-900">{l.nameEn}</span>
            <Badge variant="secondary" className="text-xs">
              {l.levelEn}
            </Badge>
          </div>
        ))}
      </CvSection>
      </div>
    </div>
  );
}

function CvSection(props: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="border-neutral-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">{props.title}</CardTitle>
        <Badge variant="outline" className="text-xs font-normal">
          {props.count}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">{props.children}</CardContent>
    </Card>
  );
}
