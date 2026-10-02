"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign, OutreachContact, OutreachList } from "./model";
import {
  addRemoteContact,
  createRemoteList,
  emptyOutreach,
  importRemoteContacts,
  loadRemoteOutreach,
  markRemoteDoNotContact,
  saveRemoteCampaign,
  saveRemoteContext,
  saveRemoteDraft,
} from "./remote";

export function useOutreach() {
  const [state, setState] = useState(emptyOutreach);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const next = await loadRemoteOutreach();
    setState(next);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    loadRemoteOutreach()
      .then((next) => {
        if (active) setState(next);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load outreach.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(task: () => Promise<void>) {
    try {
      await task();
      await reload();
      return null;
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : "Request failed.";
      setError(message);
      return message;
    }
  }

  return {
    state,
    ready,
    error,
    reload,
    addContact: (input: Omit<OutreachContact, "id" | "status">) => run(() => addRemoteContact(input)),
    importContacts: (rows: Omit<OutreachContact, "id" | "status">[], listId: string, listName: string) =>
      run(() => importRemoteContacts(rows, listId, listName)),
    createList: (list: Omit<OutreachList, "id">) => run(() => createRemoteList(list)),
    markDoNotContact: (contactId: string) => run(() => markRemoteDoNotContact(contactId)),
    saveContext: (title: string, content: string) => run(() => saveRemoteContext(title, content)),
    saveCampaign: (campaign: Omit<Campaign, "id" | "metrics">) => run(() => saveRemoteCampaign(campaign)),
    saveDraft: (threadId: string, body: string, reasoning: string) => run(() => saveRemoteDraft(threadId, body, reasoning).then(() => undefined)),
  };
}
