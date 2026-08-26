import "../styles/globals.css";
import "../styles/TitleBar.css";

import { ThemeProvider } from "../contexts/ThemeContext";
import { ModelProvider } from "../contexts/ModelContext";

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <ModelProvider>
        <Component {...pageProps} />
      </ModelProvider>
    </ThemeProvider>
  );
}

export default MyApp;