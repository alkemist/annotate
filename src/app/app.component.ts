import {AfterViewInit, Component, computed, ElementRef, HostListener, signal, ViewChild} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {StoreService} from "./services/store.service";
import {SharedModule} from "./modules/shared.module";
import {AnnotateImage} from "./models/annotateImage";
import {DirFile} from "./models/dirFile";
import {MenuItem, MessageService} from "primeng/api";
import {Annotation} from "./models/annotation";
import {AnnotationLabel} from "./models/annotationLabel";
import {CanvasService} from "./services/canvas.service";
import packageJson from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit {
  @ViewChild('dirInput') dirInput?: ElementRef<HTMLInputElement>;
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('image') image?: ElementRef<HTMLImageElement>;
  public version: string = packageJson.version;
  pageLoaded = signal(false);
  fileLoaded = computed(() =>
    this.storeService.imageLoaded() && this.storeService.annotationsLoaded()
  )
  dirName = signal("");
  listFiles = computed(() =>
    this.storeService.files()
  );
  annotationsLoading = computed(() =>
    !this.storeService.annotationsLoaded()
  )
  listAnnotations = computed(() =>
    this.storeService.annotationsLoaded() && this.storeService.getAnnotations()
      ? this.storeService.getAnnotations()
      : []
  );
  listLabels = computed(() =>
    this.storeService.labelsLoaded() && this.storeService.getLabels()
      ? this.storeService.getLabels()
      : []
  );
  labelsLoading = computed(() =>
    this.dirName() && !this.storeService.labelsLoaded()
  )
  imageData = computed(() =>
    this.storeService.imageLoaded()
      ? this.storeService.getImageData()
      : []
  );
  filterValue = computed(() =>
    this.storeService.lastLoaded()
      ? this.storeService.filterValue
      : ''
  )
  selectedFile: AnnotateImage | null = null;
  saving = computed(() =>
    this.storeService.annotationsSaving() && this.storeService.labelsSaving()
  );
  hasChange = computed(() =>
    this.storeService.hasChange()
  );
  imageMenuBar = signal<MenuItem[]>([])
  dialogVisible: boolean = false;
  selectedAnnotationLabel?: AnnotationLabel;
  selectedFileIndex: number = 0;
  private selectedAnnotationIndex: number | null = null;

  constructor(
    private storeService: StoreService,
    private canvasService: CanvasService,
    private messageService: MessageService
  ) {

  }

  @HostListener('document:keydown.control.s', ['$event']) onCtrlS(event: KeyboardEvent) {
    event.preventDefault();
    this.save()
  }

  @HostListener('document:keydown.control.q', ['$event']) onCtrlQ(event: KeyboardEvent) {
    event.preventDefault();
    this.prevFile();
  }

  @HostListener('document:keydown.control.d', ['$event']) onCtrlD(event: KeyboardEvent) {
    event.preventDefault();
    this.nextFile()
  }

  @HostListener('document:keydown.control.z', ['$event']) onCtrlZ(event: KeyboardEvent) {
    event.preventDefault();
    this.back()
  }

  ngAfterViewInit(): void {
    this.canvasService.loadCanvas(this.canvas!.nativeElement)
    this.pageLoaded.set(true);
  }

  onImageLoad() {
    this.canvasService.loadImage(
      this.canvas!.nativeElement,
      this.image!.nativeElement,
      this.storeService.getAnnotations(),
      this.storeService.getLabels()
    )
  }

  openDirectorySelection() {
    this.dirInput?.nativeElement.click()
  }

  selectDirectory(event: Event) {
    let showError = true;
    const element = event.currentTarget as HTMLInputElement;

    if (element.files) {
      const files = Array.from(element.files) as unknown as DirFile[];

      if (files.length > 0) {
        const directory = this.storeService.loadFiles(files);

        if (directory) {
          this.dirName.set(directory);

          this.selectedFile = this.listFiles()[0]
          this.onFileChange();
          showError = false;
        }
      }
    }

    if (showError) {
      this.storeService.resetStore();
      this.canvasService.clear()
      this.imageMenuBar.set([]);
      this.dirName.set("");

      this.selectedFile = null;

      this.messageService.add({
        severity: 'warn',
        summary: 'Empty directory',
        detail: 'No images in this directory'
      });
    }
    (event.target as any).value = '';
  }

  onFileChange() {
    if (this.selectedFile) {
      this.selectedFileIndex = this.listFiles().indexOf(this.selectedFile!);

      this.imageMenuBar.set([
        {
          disabled: this.selectedFileIndex == 0,
          icon: 'pi pi-angle-left',
          command: () => {
            this.prevFile()
          }
        },
        {
          label: `${this.selectedFileIndex + 1} / ${this.listFiles().length}`
        },
        {
          label: this.selectedFile?.name
        },
        {
          disabled: this.selectedFileIndex == this.listFiles().length - 1,
          icon: 'pi pi-angle-right',
          command: () => {
            this.nextFile()
          }
        },
      ])

      this.storeService.loadFile(this.selectedFile!)
    }
  }

  reDraw() {
    this.canvasService.reDraw(
      this.storeService.getAnnotations(),
      this.storeService.getLabels()
    )
  }

  save() {
    if (this.dialogVisible) {
      this.saveAnnotation()
    } else if (this.hasChange() && this.selectedFile) {
      this.storeService.saveAnnotations(
        this.selectedFile!,
        this.canvasService.getNormPoints()
      )
    }
  }

  editAnnotation(annotation: Annotation, annotationIndex: number) {
    this.dialogVisible = true;
    this.selectedAnnotationLabel = this.listLabels().at(annotation.index)
      ? this.listLabels().at(annotation.index)!
      : undefined;
    this.selectedAnnotationIndex = annotationIndex;
  }

  saveAnnotation() {
    this.dialogVisible = false;
    this.storeService.editAnnotation(
      this.selectedAnnotationIndex!,
      this.selectedAnnotationLabel!
    )
    this.reDraw()
  }

  removeAnnotation() {
    this.dialogVisible = false;
    this.storeService.removeAnnotation(this.selectedAnnotationIndex!)
    this.canvasService.reDraw(this.storeService.getAnnotations(), this.storeService.getLabels())
  }

  removeLabelDisabled(index: number) {
    return this.listAnnotations().some(annotation => annotation.index >= index)
      || this.listLabels().length === 1;
  }

  removeLabel(index: number) {
    this.storeService.removeLabel(index)
  }

  checkChanges() {
    this.storeService.checkChanges()
  }

  undo() {
    this.storeService.undo();
    this.reDraw()
  }

  onLabelChange() {
    this.checkChanges();
    this.reDraw();
  }

  cloneAnnotation() {
    this.storeService.duplicateAnnotation(this.selectedAnnotationIndex!)
  }

  addLabel() {
    this.storeService.addLabel()
  }

  private prevFile() {
    if (!this.hasChange() && !this.dialogVisible) {
      this.selectedFile = this.listFiles()[this.selectedFileIndex - 1]
      this.onFileChange();
    }
  }

  private nextFile() {
    if (!this.hasChange() && !this.dialogVisible) {
      this.selectedFile = this.listFiles()[this.selectedFileIndex + 1]
      this.onFileChange();
    }
  }

  private back() {
    if (this.dialogVisible) {
      this.dialogVisible = false;
    }
  }
}
