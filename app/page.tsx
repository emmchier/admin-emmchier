import { artClients, hubClients, getEntryLocale } from '@/lib/contentful/clients';
import { RootCms } from '@/components/dashboard/RootCms';
import {
  createEntryAction,
  deleteEntryAction,
  publishEntryAction,
  unpublishEntryAction,
  updateEntryAction,
} from '@/app/dashboard/art/actions';
import {
  hubCreateEntryAction,
  hubDeleteEntryAction,
  hubPublishEntryAction,
  hubUnpublishEntryAction,
  hubUpdateEntryAction,
} from '@/app/dashboard/hub/actions';

export default function Home() {
  const entryLocale = getEntryLocale();

  return (
    <RootCms
      entryLocale={entryLocale}
      artSpaceId={artClients.spaceId}
      hubSpaceId={hubClients.spaceId}
      artActions={{
        createEntryAction,
        updateEntryAction,
        deleteEntryAction,
        publishEntryAction,
        unpublishEntryAction,
      }}
      hubActions={{
        createEntryAction: hubCreateEntryAction,
        updateEntryAction: hubUpdateEntryAction,
        deleteEntryAction: hubDeleteEntryAction,
        publishEntryAction: hubPublishEntryAction,
        unpublishEntryAction: hubUnpublishEntryAction,
      }}
    />
  );
}
