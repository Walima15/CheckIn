import React from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { TxProvider } from "@/hooks/TxContext";
import { WalletProvider } from "@/hooks/WalletContext";
import Activity from "@/pages/Activity";
import CheckIn from "@/pages/CheckIn";
import CreateEvent from "@/pages/CreateEvent";
import EditEvent from "@/pages/EditEvent";
import EventDetails from "@/pages/EventDetails";
import Events from "@/pages/Events";
import Home from "@/pages/Home";
import MyTickets from "@/pages/MyTickets";
import Organizer from "@/pages/Organizer";
import OrganizerEvent from "@/pages/OrganizerEvent";
import Rewards from "@/pages/Rewards";
import TicketDetails from "@/pages/TicketDetails";

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { message: string }> {
  state = { message: "" };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="mx-auto max-w-lg p-8">
          <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-sm text-muted">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <WalletProvider>
        <TxProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="events" element={<Events />} />
              <Route path="events/:id" element={<EventDetails />} />
              <Route path="events/:id/edit" element={<EditEvent />} />
              <Route path="create" element={<CreateEvent />} />
              <Route path="tickets" element={<MyTickets />} />
              <Route path="tickets/:id" element={<TicketDetails />} />
              <Route path="checkin" element={<CheckIn />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="organizer" element={<Organizer />} />
              <Route path="organizer/events/:id" element={<OrganizerEvent />} />
              <Route path="activity" element={<Activity />} />
              <Route path="*" element={<p className="text-sm">That page does not exist.</p>} />
            </Route>
          </Routes>
        </TxProvider>
      </WalletProvider>
    </AppErrorBoundary>
  );
}
