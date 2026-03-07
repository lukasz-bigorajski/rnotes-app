import { AppShell } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Sidebar } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";

export default function App() {
  const [opened] = useDisclosure(true);

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Navbar p="sm">
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        <ContentArea />
      </AppShell.Main>
    </AppShell>
  );
}
