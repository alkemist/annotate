import {NgModule} from '@angular/core';
import {ButtonModule} from "primeng/button";
import {ListboxModule} from "primeng/listbox";
import {StoreService} from "../services/store.service";
import {MenubarModule} from "primeng/menubar";
import {SplitterModule} from "primeng/splitter";
import {InputSwitchModule} from "primeng/inputswitch";
import {ColorPickerModule} from "primeng/colorpicker";
import {ContextMenuModule} from "primeng/contextmenu";
import {InputTextModule} from "primeng/inputtext";
import {DialogModule} from "primeng/dialog";
import {DropdownModule} from "primeng/dropdown";
import {RippleModule} from "primeng/ripple";
import {ScrollPanelModule} from "primeng/scrollpanel";
import {ToastModule} from "primeng/toast";
import {MessageService} from "primeng/api";
import {CanvasService} from "../services/canvas.service";
import {ScrollerModule} from "primeng/scroller";
import {InputNumberModule} from "primeng/inputnumber";

const modules = [
  ButtonModule,
  ListboxModule,
  MenubarModule,
  SplitterModule,
  InputSwitchModule,
  ColorPickerModule,
  ContextMenuModule,
  InputTextModule,
  DialogModule,
  DropdownModule,
  RippleModule,
  ScrollPanelModule,
  ToastModule,
  ScrollerModule,
  InputNumberModule
]

@NgModule({
  imports: modules,
  providers: [
    StoreService,
    CanvasService,
    MessageService
  ],
  exports: modules,
})
export class SharedModule {
}
