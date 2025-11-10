import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Splash from "./pages/Splash";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Results from "./pages/Results";
import BookDetails from "./pages/BookDetails";
import ShelfMap from "./pages/ShelfMap";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<><Navbar /><Splash /></>} />
            {/* إخفاء الشريط العلوي أثناء صفحة تسجيل الدخول */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/home" element={<><Navbar /><Home /></>} />
            <Route path="/search" element={<><Navbar /><Search /></>} />
            <Route path="/results" element={<><Navbar /><Results /></>} />
            <Route path="/book/:id" element={<><Navbar /><BookDetails /></>} />
            <Route path="/shelf" element={<><Navbar /><ShelfMap /></>} />
            <Route path="/chat" element={<><Navbar /><Chat /></>} />
            <Route
              path="/admin"
              element={
                <>
                  <Navbar />
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                </>
              }
            />
            <Route path="*" element={<><Navbar /><NotFound /></>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
