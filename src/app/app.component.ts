import {AfterViewInit, Component, computed, ElementRef, HostListener, signal, ViewChild} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {StoreService} from "./services/store.service";
import {SharedModule} from "./modules/shared.module";
import {AnnotateImage} from "./models/annotateImage";
import {DirFile} from "./models/dirFile";
import {ConfirmationService, MessageService} from "primeng/api";
import {Annotation} from "./models/annotation";
import {AnnotationLabel} from "./models/annotationLabel";
import {CanvasService} from "./services/canvas.service";
import packageJson from '../../package.json';
import {ConfirmDialogModule} from "primeng/confirmdialog";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ConfirmDialogModule,
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
    this.storeService.annotations()
  );
  listLabels = computed(() =>
    this.storeService.labels()
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
  deleteSecurity: boolean = true;
  saving = computed(() =>
    this.storeService.annotationsSaving() && this.storeService.labelsSaving()
  );
  hasChange = computed(() =>
    this.storeService.hasChange()
  );
  annotationDialogVisible: boolean = false;
  paramDialogVisible: boolean = false;
  selectedAnnotationLabel = signal<AnnotationLabel | null>(null);
  defaultAnnotationLabel = signal<AnnotationLabel | null>(null);
  selectedFileIndex: number = 0;
  navigationIndex: number = 0;
  private selectedAnnotationIndex: number | null = null;

  constructor(
    private storeService: StoreService,
    private canvasService: CanvasService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {

  }

  @HostListener('document:keydown.control.s', ['$event']) onCtrlS(event: KeyboardEvent) {
    event.preventDefault();
    this.save()
  }

  @HostListener('document:keydown.control.q', ['$event']) onCtrlQ(event: KeyboardEvent) {
    event.preventDefault();
    this.onSelectionChange(this.selectedFileIndex - 1);
  }

  @HostListener('document:keydown.control.d', ['$event']) onCtrlD(event: KeyboardEvent) {
    event.preventDefault();
    this.onSelectionChange(this.selectedFileIndex + 1);
  }

  @HostListener('document:keydown.control.z', ['$event']) onCtrlZ(event: KeyboardEvent) {
    event.preventDefault();
    this.back()
  }

  ngAfterViewInit(): void {
    this.canvasService.loadCanvas(this.canvas!.nativeElement);
    this.pageLoaded.set(true);
  }

  onImageLoad() {
    this.canvasService.loadImage(
      this.image!.nativeElement,
      this.storeService.annotations(),
      this.storeService.labels()
    )

    if (this.defaultAnnotationLabel() === null) {
      this.defaultAnnotationLabel.set(this.listLabels()[0])
    }
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
      const index = (this.listFiles().indexOf(this.selectedFile!)) + 1;

      if (index > 0) {
        this.selectedFileIndex = this.navigationIndex = index;
        this.storeService.loadFile(this.selectedFile!)
      } else {
        this.selectedFile = null;
      }
    }
  }

  reDraw() {
    this.canvasService.reDraw(
      this.storeService.annotations(),
      this.storeService.labels()
    )
  }

  save() {
    if (this.annotationDialogVisible) {
      this.saveAnnotation()
    } else if (this.hasChange() && this.selectedFile) {
      this.storeService.saveAnnotations(
        this.selectedFile!,
        this.canvasService.getNormPoints()
      )
    }
  }

  editAnnotation(annotation: Annotation, annotationIndex: number) {
    this.annotationDialogVisible = true;
    this.selectedAnnotationLabel.set(this.listLabels().at(annotation.index)
      ? this.listLabels().at(annotation.index)!
      : null);
    this.selectedAnnotationIndex = annotationIndex;
  }

  saveAnnotation() {
    this.annotationDialogVisible = false;
    this.storeService.editAnnotation(
      this.selectedAnnotationIndex!,
      this.selectedAnnotationLabel()!
    )
    this.reDraw()
  }

  removeAnnotation() {
    this.annotationDialogVisible = false;
    this.storeService.removeAnnotation(this.selectedAnnotationIndex!)
    this.reDraw()
  }

  removeLabelDisabled(index: number) {
    return this.listAnnotations().some(annotation => annotation.index >= index)
      || this.listLabels().length === 1;
  }

  removeLabel(index: number) {
    this.storeService.removeLabel(index)
  }

  remove() {
    if (this.deleteSecurity) {
      this.confirmationService.confirm({
        message: 'Do you want to delete this image?',
        header: 'Delete Confirmation',
        icon: 'pi pi-info-circle',
        acceptButtonStyleClass: "p-button-danger p-button-text",
        rejectButtonStyleClass: "p-button-text p-button-text",
        acceptIcon: "none",
        rejectIcon: "none",

        accept: () => {
          this.deleteAnnotationImage()
        },
        reject: () => {
        }
      });
    } else {
      this.deleteAnnotationImage()
    }
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
    this.storeService.duplicateAnnotation(this.selectedAnnotationIndex!);
  }

  addLabel() {
    this.storeService.addLabel()
  }

  onSelectionChange(navigationIndex: number, forceChange = false) {
    if (!navigationIndex || navigationIndex <= 0) navigationIndex = 1;
    if (navigationIndex >= this.listFiles().length) navigationIndex = this.listFiles().length

    if (
      !this.hasChange()
      && !this.annotationDialogVisible
      && (navigationIndex !== this.selectedFileIndex || forceChange)
    ) {
      this.selectedFileIndex = navigationIndex;
      this.selectedFile = this.listFiles()[navigationIndex - 1]
      this.onFileChange();
    }
  }

  sortAnnotations() {
    this.storeService.sortAnnotations(this.storeService.annotations())
    this.reDraw();
  }

  onResize() {
    this.canvasService.resize()
  }

  defaultAnnotationLabelChange() {
    this.storeService.setDefaultAnnotationLabel(this.defaultAnnotationLabel()!.id)
    this.paramDialogVisible = false;
  }

  private deleteAnnotationImage() {
    this.storeService.removeImage(this.selectedFile!)
    this.onSelectionChange(this.selectedFileIndex, true)
  }

  private back() {
    if (this.annotationDialogVisible) {
      this.annotationDialogVisible = false;
    }
  }
}
