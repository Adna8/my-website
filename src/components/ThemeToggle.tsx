import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="transition-fast"
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-white/70 hover:text-white" />
      ) : (
        <Moon className="h-5 w-5 text-white/70 hover:text-white" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
