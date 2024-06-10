import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: any[]) => void,
      receive: (channel: string, callback: (...args: any[]) => void) => void
    };
  }
}


bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
