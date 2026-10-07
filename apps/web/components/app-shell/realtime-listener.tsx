"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { io } from "socket.io-client";

import api from "@/lib/api/axios";
import type { IncidentRow } from "@/lib/api/incidents";

type IncidentMessage = {
  incident: IncidentRow;
  by?: { id: string; name: string } | null;
};

const EVENTS = [
  "incident.created",
  "incident.updated",
  "incident.acknowledged",
  "incident.resolved",
];

// Keeps one live connection open while someone is in the app. When the API
// says an incident changed, the screens that show incidents reload their
// data, so nobody has to refresh the page.
export function RealtimeListener() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!url) return;

    // The login cookie goes along with the connection; that's how the API
    // knows who this is and which organization's events to send.
    const socket = io(`${url}/realtime`, { withCredentials: true });

    const reload = () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident"] });
      queryClient.invalidateQueries({ queryKey: ["incident-events"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service"] });
    };

    for (const event of EVENTS) socket.on(event, reload);

    socket.on("incident.created", ({ incident }: IncidentMessage) => {
      toast(`INC-${incident.number} · ${incident.title}`, {
        description: `New ${incident.severity.toLowerCase()} incident on ${incident.service.name}`,
        action: {
          label: "Open",
          onClick: () => router.push(`/incidents/${incident.number}`),
        },
      });
    });

    // After a dropped connection, events may have been missed.
    socket.io.on("reconnect", reload);

    // The API closes the connection when the login cookie has expired (it
    // lasts an hour). Get a fresh one and connect again, but only once per
    // disconnect so a real logout doesn't loop.
    let retried = false;
    socket.on("connect", () => {
      retried = false;
    });
    socket.on("disconnect", async (reason) => {
      if (reason !== "io server disconnect" || retried) return;
      retried = true;
      try {
        await api.post("/auth/refresh");
        socket.connect();
      } catch {
        // Not logged in any more; the next page load goes to /login.
      }
    });

    return () => {
      socket.close();
    };
  }, [queryClient, router]);

  return null;
}
