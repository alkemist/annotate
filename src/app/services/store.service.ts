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
      window.api.receive("sendReadContent", (filePath: string, data: string) => {
        const fileName = filePath.split('/').at(-1)!;
        const ext = fileName.split('.').at(-1)!
        const captureName = fileName.replace('.' + ext, '')

        if (ext === 'txt') {
          const annotations =
            data.split("\n").filter(line => line.trim())
              .map((line) => {
                const splittedLine = line.split(' ');
                const index = parseInt(splittedLine[0]);

                return {
                  index,
                  points: splittedLine.slice(1).map(point => parseFloat(point)),
                  visible: true,
                }
              })
          this.sortAnnotations(annotations);
          this._annotations.set(annotations);

          this.compareEngine!.updateInLeft(this._annotations(), ['annotations'])
          this.compareEngine!.leftToRight()

          this.annotationsLoaded.set(true)
        } else if (this.labelsNames.includes(fileName)) {
          this._labels.set(
            data.split("\n").filter(line => line.trim())
              .map((label, index) => ({
                id: index,
                name: label,
                color: this.colors[index] ?? tinycolor.random().toRgb(),
              }))
          );

          this.compareEngine!.updateInLeft(this._labels(), ['labels'])
          this.compareEngine!.leftToRight()

          this.labelsLoaded.set(true)
        } else if (this.lastNames.includes(fileName)) {
          this.filterValue = data;
          this.lastLoaded.set(true)
        } else {
          const annotateImage = this.filesMap.get(captureName);

          this.imageData = `data:${annotateImage.imageType};base64, ${data}`;
          this.imageLoaded.set(true)
        }
      })

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

      window.api.receive("sendRemoveEnd", (filePath: string) => {
        const fileName = filePath.split('/').at(-1)!;
      });
    }
  }

  private _labels = signal<AnnotationLabel[]>([]);

  get labels() {
    return this._labels.asReadonly();
  }

  private _annotations = signal<Annotation[]>([]);

  get annotations() {
    return this._annotations.asReadonly();
  }

  private _files = signal<AnnotateImage[]>([]);

  get files() {
    return this._files.asReadonly()
  }

  loadFile(annotateImage: AnnotateImage) {
    //console.log("loadFile", annotateImage);
    this.annotationsLoaded.set(false)
    this._annotations.set([]);

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
    this._labels.set([])
    this._annotations.set([]);

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
          `${this._annotations()[index].index} ${normPoint.xCenter} ${normPoint.yCenter} ${normPoint.w} ${normPoint.h}`
      )
    );
    this.annotationsSaving.set(true)
    this.labelsSaving.set(true)

    void this.saveFile(
      annotateImage.annotationsPath ?? `${this.dirPath}/${annotateImage.name}.txt`,
      lines.join("\n")
    )

    void this.saveFile(
      this.labelsPath,
      this._labels().map(label => label.name).join("\n")
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

  removeImage(annotateImage: AnnotateImage) {
    if (annotateImage.annotationsPath) {
      void this.removeFile(
        annotateImage.annotationsPath)
    }
    void this.removeFile(
      annotateImage.imagePath
    )
    this.filesMap.delete(annotateImage.name);
    this._files.set(this.filesMap.getValues());
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
    this._annotations.set([...this._annotations(), annotation])
    return annotation;
  }

  getImageData() {
    return this.imageData;
  }

  editAnnotation(annotationIndex: number, label: AnnotationLabel) {
    console.log(annotationIndex, label)

    const annotations = this._annotations()
    annotations[annotationIndex].index = label.id;
    this._annotations.set(annotations)

    console.log(annotations);
    this.checkChanges();
  }

  sortAnnotations(annotations: Annotation[]) {
    annotations.sort((a, b) => a.index - b.index);
  }

  removeAnnotation(annotationIndex: number) {
    this._annotations.set(
      this.annotations().filter((_, index) => index !== annotationIndex)
    )

    this.checkChanges();
  }

  addLabel() {
    const index = this._labels().length;
    const color = this.colors[index] ?? tinycolor.random().toRgb()

    const labels = this._labels();
    labels.push({
      id: index,
      name: index.toString(),
      color
    });
    this._labels.set(labels);

    this.checkChanges()
  }

  checkLabels() {
    this._annotations().forEach((annotation) => {
      if (!this._labels().at(annotation.index)) {
        for (let i = this._labels.length - 1; i < annotation.index; i++) {
          this.addLabel()
        }
      }
    })
  }

  removeLabel(labelIndex: number) {
    this._labels.set(
      this._labels().filter((_, index) => index !== labelIndex)
    )

    this.checkChanges();
  }

  updateAnnotations(normPoints: NormPoints[]) {
    const annotations = this._annotations();
    annotations.forEach((annotation, index) => {
      annotation.points = [
        normPoints[index].xCenter,
        normPoints[index].yCenter,
        normPoints[index].w,
        normPoints[index].h,
      ];
    })
    this._annotations.set(annotations);

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

    this._labels.set(
      this.compareEngine!.getInLeft(['labels']) as AnnotationLabel[]
    );
    this._annotations.set(
      this.compareEngine!.getInLeft(['annotations']) as Annotation[]
    );

    this.checkLabels();

    this.labelsLoaded.set(true);
    this.annotationsLoaded.set(true);

    this.checkChanges()
  }

  duplicateAnnotation(index: number) {
    const annotations = TypeHelper.deepClone(
      this._annotations()
    );

    let copy = TypeHelper.deepClone(
      annotations[index]
    );

    annotations.push(copy)

    this._annotations.set(annotations);

    this.checkChanges();
  }

  private getState() {
    return {
      labels: this._labels(),
      annotations: this._annotations()
    }
  }

  private async retrieveFile(path: string) {
    return window.api.send("askToRead", path);
  }

  private async saveFile(path: string, content: string) {
    return window.api.send("askToWrite", path, content);
  }

  private async removeFile(path: string) {
    return window.api.send("askToRemove", path);
  }
}
