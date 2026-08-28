import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="images/offyai.png" />
        <link rel="apple-touch-icon" href="images/offyai.png" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' file:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:; connect-src 'self' http://127.0.0.1:8080 http://localhost:8080; font-src 'self' data:;"
        />
        <meta
          name="description"
          content="OffyAI - Modern AI Web UI with Advanced Monitoring"
        />
      </Head>
      <body className="bg-gray-900 text-gray-100">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}