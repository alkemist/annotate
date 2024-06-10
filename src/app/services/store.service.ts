import {effect, Injectable, signal} from "@angular/core";
import {Annotation} from '../models/annotation'
import {ArrayHelper, SmartMap, TypeHelper} from "@alkemist/smart-tools";
import {AnnotateImage} from "../models/annotateImage";
import {DirFile} from "../models/dirFile";
import {Color} from "../models/color";
import {NormPoints} from "../models/yoloUtils";
import {AnnotationLabel} from "../models/annotationLabel";
import {CompareEngine} from "@alkemist/compare-engine";
import tinycolor from "tinycolor2";
import {PathHelper} from "../models/pathHelper";

@Injectable()
export class StoreService {
  public imageLoaded = signal(false);
  public annotationsLoaded = signal(false);
  public labelsLoaded = signal(false);
  public lastLoaded = signal(false);
  public annotationsSaving = signal(false);
  public labelsSaving = signal(false);
  public hasChange = signal(false);
  colors: Color[] = [
    {r: 111, g: 78, b: 55}, // coffee
    {r: 226, g: 61, b: 40}, // chill red
    {r: 255, g: 191, b: 0}, // amber
  ]
  public filterValue: string = '';
  private compareEngine: CompareEngine<any> | null = null;
  private annotations: Annotation[] = [];
  private labels: AnnotationLabel[] = [];
  private labelsNames = ['classes.labels'];
  private lastNames = ['search.last'];
  private imageData: string = '';
  private dirPath = '';
  private labelsPath = '';
  private lastPath = '';
  private filesMap = new SmartMap<AnnotateImage, string>()

  constructor() {
    effect(() => {
      if (this.annotationsLoaded() && this.labelsLoaded()) {
        //console.log("Loaded", this.compareEngine!.hasChange(), {...TypeHelper.deepClone(this.compareEngine!['panels'])})

        this.checkLabels();
        this.checkChanges();
      }
    }, {allowSignalWrites: true});

    if (window.api !== undefined) {
      window.api.receive("sendWriteEnd", (filePath: string) => {
        const fileName = filePath.split('/').at(-1)!;
        const ext = filePath.split('.').at(-1)!
        const captureName = fileName.replace('.' + ext, '')

        if (ext === 'txt') {
          this.annotationsSaving.set(false);
          this.filesMap.get(captureName).annotationsPath = filePath;
          this._files.set(this.filesMap.getValues())
        } else if (this.labelsNames.includes(fileName)) {
          this.labelsSaving.set(false)
        }
      });

      window.api.receive("sendReadContent", (filePath: string, data: string) => {
        const fileName = filePath.split('/').at(-1)!;
        const ext = fileName.split('.').at(-1)!
        const captureName = fileName.replace('.' + ext, '')

        if (data) {
          if (ext === 'txt') {
            this.annotations = data.split("\n").filter(line => line.trim())
              .map((line) => {
                const splittedLine = line.split(' ');
                const index = parseInt(splittedLine[0]);

                return {
                  index,
                  points: splittedLine.slice(1).map(point => parseFloat(point)),
                  visible: true,
                }
              });
            this.sortAnnotations()

            this.compareEngine!.updateInLeft(this.annotations, ['annotations'])
            this.compareEngine!.updateInRight(this.annotations, ['annotations'])

            this.annotationsLoaded.set(true)
          } else if (this.labelsNames.includes(fileName)) {
            this.labels =
              data.split("\n").filter(line => line.trim())
                .map((label, index) => ({
                  id: index,
                  name: label,
                  color: this.colors[index] ?? tinycolor.random().toRgb(),
                }))

            this.compareEngine!.updateInLeft(this.labels, ['labels'])
            this.compareEngine!.updateInRight(this.labels, ['labels'])

            this.labelsLoaded.set(true)
          } else if (this.lastNames.includes(fileName)) {
            this.filterValue = data;
            this.lastLoaded.set(true)
          } else {
            const annotateImage = this.filesMap.get(captureName);

            this.imageData = `data:${annotateImage.imageType};base64, ${data}`;
            this.imageLoaded.set(true)
          }
        }
      })
    }
  }

  private _files = signal<AnnotateImage[]>([]);

  get files() {
    return this._files.asReadonly()
  }

  loadFile(annotateImage: AnnotateImage) {
    //console.log("loadFile", annotateImage);
    this.annotationsLoaded.set(false)
    this.annotations = [];

    this.compareEngine = new CompareEngine<any>(() => 'id',
      this.getState(),
      this.getState()
    )
    this.hasChange.set(false);
    //console.log("Init", {...TypeHelper.deepClone(this.compareEngine['panels'])})

    if (annotateImage.annotationsPath) {
      void this.retrieveFile(annotateImage.annotationsPath)
    } else {
      this.annotationsLoaded.set(true)
    }

    this.imageLoaded.set(false)
    void this.retrieveFile(annotateImage.imagePath)
  }

  resetStore() {
    this.filesMap = new SmartMap<AnnotateImage, string>;
    this.labels = [];
    this.annotations = [];

    this.imageLoaded.set(false);
    this.annotationsLoaded.set(false);
    this.labelsLoaded.set(false);

    this.dirPath = '';
    this.labelsPath = '';
    this.lastPath = '';
  }

  loadFiles(files: DirFile[]): string {
    this.resetStore();
    let dirs: string[] = [];

    files.sort((a, b) => a.name.localeCompare(b.name)).forEach(async (file) => {
      const ext = file.name.split('.').at(-1)!
      const name = file.name.replace('.' + ext, '')
      const types = file.type.split('/')

      if (['image', 'text'].includes(types[0])) {
        const annotateImage: AnnotateImage = this.filesMap.has(name)
          ? this.filesMap.get(name)
          : new AnnotateImage()

        annotateImage.name = name;

        if (ext === 'txt' && annotateImage.annotationsPath
          || types[0] === 'image' && annotateImage.imagePath) {
          console.error('Duplicate')
        } else {
          if (ext === 'txt') {
            dirs.push(file.path.slice(0, file.path.length - file.name.length - 1))

            annotateImage.annotationsPath = file.path;
          }
          if (types[0] === 'image') {
            dirs.push(file.path.slice(0, file.path.length - file.name.length - 1))

            annotateImage.imagePath = file.path;
            annotateImage.imageType = file.type;
          }

          this.filesMap.set(name, annotateImage)
        }
      } else if (this.labelsNames.includes(file.name)) {
        this.labelsPath = file.path
      } else if (this.lastNames.includes(file.name)) {
        this.lastPath = file.path
      }
    })

    this.filesMap.forEach((value, key) => {
      if (!value.imagePath) {
        this.filesMap.delete(key);
      }
    })

    if (this.filesMap.size > 0) {
      this.dirPath = PathHelper.findCommonPath(ArrayHelper.unique(dirs));

      if (this.labelsPath) {
        void this.retrieveFile(this.labelsPath)
      } else {
        this.labelsPath = `${this.dirPath}/${this.labelsNames[0]}`;
        this.labelsLoaded.set(true)
      }
      if (this.lastPath) {
        void this.retrieveFile(this.lastPath)
      } else {
        this.lastPath = `${this.dirPath}/${this.lastNames[0]}`;
        this.lastLoaded.set(true)
      }

      this._files.set(this.filesMap.getValues());
      return this.dirPath;
    }

    return '';
  }

  saveAnnotations(annotateImage: AnnotateImage, annotationsPoints: NormPoints[]) {
    const lines = annotationsPoints.map(
      (
        (normPoint, index) =>
          `${this.annotations[index].index} ${normPoint.xCenter} ${normPoint.yCenter} ${normPoint.w} ${normPoint.h}`
      )
    );
    this.annotationsSaving.set(true)
    this.labelsSaving.set(true)

    if (lines.length > 0) {
      void this.saveFile(
        annotateImage.annotationsPath ?? `${this.dirPath}/${annotateImage.name}.txt`,
        lines.join("\n")
      )
    }

    void this.saveFile(
      this.labelsPath,
      this.labels.map(label => label.name).join("\n")
    )

    void this.saveFile(
      this.lastPath,
      annotateImage.name
    )

    if (this.compareEngine) {
      this.compareEngine.updateRight(this.getState())
      this.compareEngine.rightToLeft()
      this.checkChanges();
    }
  }

  addAnnotation(normCoords: NormPoints, index = 0) {
    const annotation = {
      index,
      points: [
        normCoords.xCenter,
        normCoords.yCenter,
        normCoords.w,
        normCoords.h
      ],
      visible: true
    };
    this.annotations.push(annotation)
    return annotation;
  }

  getAnnotations() {
    return this.annotations;
  }

  getLabels() {
    return this.labels;
  }

  getImageData() {
    return this.imageData;
  }

  editAnnotation(annotationIndex: number, label: AnnotationLabel) {
    this.annotations[annotationIndex].index = label.id;
    this.sortAnnotations();
    this.checkChanges();
  }

  removeAnnotation(annotationIndex: number) {
    this.annotations.splice(annotationIndex, 1)

    this.checkChanges();
  }

  addLabel() {
    const index = this.labels.length;
    const color = this.colors[index] ?? tinycolor.random().toRgb()

    this.labels.push({
      id: index,
      name: index.toString(),
      color
    });

    this.checkChanges()
  }

  checkLabels() {
    this.annotations.forEach((anonotation) => {
      if (!this.labels.at(anonotation.index)) {
        for (let i = this.labels.length - 1; i < anonotation.index; i++) {
          this.addLabel()
        }
      }
    })
  }

  removeLabel(index: number) {
    this.labels.splice(index, 1)

    this.checkChanges();
  }

  updateAnnotations(normPoints: NormPoints[]) {
    this.annotations.forEach((annotation, index) => {
      annotation.points = [
        normPoints[index].xCenter,
        normPoints[index].yCenter,
        normPoints[index].w,
        normPoints[index].h,
      ];
    })
    this.sortAnnotations();

    this.checkChanges()
  }

  checkChanges() {
    if (this.compareEngine && this.annotationsLoaded() && this.labelsLoaded()) {
      this.compareEngine.updateRight(this.getState())
      this.compareEngine.updateCompareIndex()
      this.hasChange.set(this.compareEngine.hasChange());
      //console.log("Check", this.compareEngine.hasChange(), {...TypeHelper.deepClone(this.compareEngine['panels'])})
    }
  }

  undo() {
    this.labelsLoaded.set(false);
    this.annotationsLoaded.set(false);

    this.labels = this.compareEngine!.getInLeft(['labels']) as AnnotationLabel[];
    this.annotations = this.compareEngine!.getInLeft(['annotations']) as Annotation[];

    this.checkLabels();

    this.labelsLoaded.set(true);
    this.annotationsLoaded.set(true);

    this.checkChanges()
  }

  duplicateAnnotation(index: number) {
    let copy = TypeHelper.deepClone(this.annotations[index]);
    copy = {
      points: copy.points,
      index: copy.index,
      visible: true
    }
    this.annotations.push(copy)
    this.sortAnnotations();
    this.checkChanges();
  }

  private getState() {
    return {
      labels: this.labels,
      annotations: this.annotations
    }
  }

  private async retrieveFile(path: string) {
    return window.api.send("askToRead", path);
  }

  private async saveFile(path: string, content: string) {
    return window.api.send("askToWrite", path, content);
  }

  private sortAnnotations() {
    this.annotations.sort((a, b) => a.index - b.index);
  }
}
