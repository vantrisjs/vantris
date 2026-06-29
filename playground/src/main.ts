import { appName } from "@/info";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <h1>${appName}</h1>
    <p>Running in ${import.meta.env.MODE} mode (dev: ${import.meta.env.DEV}, prod: ${import.meta.env.PROD}).</p>
    <p>HELLO: ${import.meta.env.VANTRIS_HELLO}</p>
  `;
}

export {};
