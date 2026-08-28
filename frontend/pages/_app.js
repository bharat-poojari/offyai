import "../styles/globals.css";
import "../styles/TitleBar.css";

import { ThemeProvider } from "../contexts/ThemeContext";
import { ModelProvider } from "../contexts/ModelContext";
import { ProfileProvider } from "../contexts/ProfileContext";

function MyApp({ Component, pageProps }) {
  return (
    <ProfileProvider>
      <ThemeProvider>
        <ModelProvider>
          <Component {...pageProps} />
        </ModelProvider>
      </ThemeProvider>
    </ProfileProvider>
  );
}

export default MyApp;