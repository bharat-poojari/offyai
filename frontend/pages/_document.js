import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="/images/offyai.png" />
        <link rel="apple-touch-icon" href="/images/offyai.png" />
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