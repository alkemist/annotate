import {Injectable} from '@angular/core';
import {StoreService} from "./store.service";
import {Rectangle} from "../models/rectangle";
import {AnnotationLabel} from "../models/annotationLabel";
import {ClickEvent} from "../models/clickEvent";
import {Annotation} from "../models/annotation";
import {YoloUtils} from "../models/yoloUtils";
import {Point} from "../models/point";
import tinycolor from "tinycolor2";

@Injectable({
  providedIn: 'root'
})
export class CanvasService {
  private baseFontSize = 16;
  private handleRadius = 6;
  private labelPadding = 8;
  private labelStickLength = 20;
  private labelStickWidth = 8;
  private rectangleLineWidth = 3;
  private rectangleOpacity = 0.2;
  private displayRatio = 1;
  private rectangles: Rectangle[] = [];
  private dragTL = false;
  private dragBL = false;
  private dragTR = false;
  private dragBR = false;
  private dragWholeRect = false;
  private dragRectangleIndex: number | null = null;
  private dragRectangle: Rectangle | null = null;
  private labels: AnnotationLabel[] = [];
  private startX = 0;
  private startY = 0;
  private canvas?: HTMLCanvasElement;
  private image?: HTMLImageElement;

  constructor(private storeService: StoreService) {
  }

  private _width = 0;

  get width() {
    return this._width;
  }

  private _height = 0;

  get height() {
    return this._height;
  }

  loadCanvas(
    canvas: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', (e) => this.mouseDown(e as ClickEvent), false);
    canvas.addEventListener('mouseup', () => this.mouseUp(), false);
    canvas.addEventListener('mousemove', (e) => this.mouseMove(e as ClickEvent), false);
    canvas.addEventListener('touchstart', (e) => this.mouseDown(e as unknown as ClickEvent));
    canvas.addEventListener('touchmove', (e) => this.mouseMove(e as unknown as ClickEvent));
    canvas.addEventListener('touchend', () => this.mouseUp());
    canvas.addEventListener('mouseleave', () => this.mouseLeave());
    window.addEventListener('resize', () => this.resize());
  }

  public loadImage(
    image: HTMLImageElement,
    annotations: Annotation[],
    labels: AnnotationLabel[],
  ) {
    this.image = image;
    this._width = this.canvas!.width = image.naturalWidth;
    this._height = this.canvas!.height = image.naturalHeight;

    this.resize()

    this.reDraw(annotations, labels)
  }

  public calcRectangle(annotation: Annotation) {
    const label = this.labels[annotation.index];
    const color = label.color

    const coords = YoloUtils.calcOrthogonalPoints(
      annotation.points[0],
      annotation.points[1],
      annotation.points[2],
      annotation.points[3],
      this._width,
      this._height
    )

    return {
      label: label.name,
      left: coords.x1 < coords.x2 ? coords.x1 : coords.x2,
      top: coords.y1 < coords.y2 ? coords.y1 : coords.y2,
      width: Math.abs(coords.x2 - coords.x1),
      height: Math.abs(coords.y2 - coords.y1),
      color: `rgba(${color.r},${color.g},${color.b}, 1)`,
      visible: annotation.visible
    };
  }

  public reDraw(annotations: Annotation[], labels: AnnotationLabel[]) {
    this.labels = labels;

    this.rectangles = [];

    annotations.forEach((annotation: Annotation, index) => {
      this.rectangles.push(
        this.calcRectangle(annotation)
      )
    })

    this.drawRectangles()
  }

  updateDragRectangle(left: number, top: number, width: number, height: number) {
    if (left >= 0 && left <= this._width
      && top >= 0 && top <= this._height
      && left + width >= 0 && left + width <= this._width
      && top + height >= 0 && top + height <= this._height
    )
      this.rectangles[this.dragRectangleIndex!] = {
        ...this.rectangles[this.dragRectangleIndex!],
        left, top, width, height
      }

    this.drawRectangles()
  }

  public getNormPoints() {
    return this.rectangles.map(
      rect => YoloUtils.calcNormPoints(
        rect.left,
        rect.top,
        rect.left + rect.width,
        rect.top + rect.height,
        this._width,
        this._height
      )
    );
  }

  clear() {
    const ctx = this.canvas!.getContext("2d")!;
    ctx.clearRect(0, 0, this._width, this._height);
  }

  drawReferences(point: Point) {
    this.drawReference(
      {x: point.x, y: 0},
      {x: point.x, y: this._height},
    )
    this.drawReference(
      {x: 0, y: point.y},
      {x: this._width, y: point.y},
    )
  }

  drawReference(from: Point, to: Point) {
    const ctx = this.canvas!.getContext("2d")!;
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 5]);
    ctx.strokeStyle = "#000";
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  public resize() {
    this.displayRatio = this.image!.naturalWidth / this.image!.width;
  }

  private drawRectangles() {
    this.clear();

    this.rectangles.forEach((rect) => {
      if (rect.visible) {
        this.drawRectangle(rect.left, rect.top, rect.width, rect.height, rect.color);
        this.drawHandles(rect.left, rect.top, rect.width, rect.height, rect.color);
        this.drawLabel(rect.label, rect.left, rect.top, rect.color);
      }
    })
  }

  private mouseUp() {
    if (this.dragTL || this.dragTR || this.dragBL || this.dragBR || this.dragWholeRect) {
      this.storeService.updateAnnotations(this.getNormPoints());
    }

    this.dragTL = this.dragTR = this.dragBL = this.dragBR = false;
    this.dragWholeRect = false;
    this.dragRectangle = null;
    this.dragRectangleIndex = null;
  }

  private getMousePos(evt: ClickEvent): Point {
    return {
      x: evt.offsetX * this.displayRatio,
      y: evt.offsetY * this.displayRatio
    }
  }

  private mouseDown(e: ClickEvent) {
    if (e.button === 2) {
      return false;
    }

    let pos = this.getMousePos(e);
    this.startX = pos.x;
    this.startY = pos.y;

    if (this.dragRectangleIndex === null) {
      this.dragRectangleIndex = this.getRectangleOnClick(pos.x, pos.y);

      if (this.dragRectangleIndex === null) {
        const normPoints = YoloUtils.calcNormPoints(
          pos.x,
          pos.y,
          pos.x,
          pos.y,
          this._width,
          this._height
        )

        const annotation = this.storeService.addAnnotation(normPoints)

        this.rectangles.push(
          this.calcRectangle(annotation)
        )

        this.dragRectangleIndex = this.getRectangleOnClick(pos.x, pos.y);
      }

      this.dragRectangle = this.rectangles[this.dragRectangleIndex!];
    }

    return true;
  }

  private mouseMove(e: ClickEvent) {
    let pos = this.getMousePos(e);

    if (this.dragRectangleIndex !== null) {
      const rect = this.dragRectangle!;

      if (this.dragWholeRect) {
        const diffX = this.startX - pos.x;
        const diffY = this.startY - pos.y;

        this.updateDragRectangle(
          rect.left - diffX,
          rect.top - diffY,
          rect.width,
          rect.height
        )
      } else {
        let left, top, width, height;
        left = top = width = height = 0;

        if (this.dragTL || this.dragBL) {
          left = pos.x < rect.left + rect.width
            ? pos.x : rect.left + rect.width;
          width = pos.x < rect.left + rect.width
            ? rect.left + rect.width - left : pos.x - left;
        }

        if (this.dragTL || this.dragTR) {
          top = pos.y < rect.top + rect.height
            ? pos.y : rect.top + rect.height;
          height = pos.y < rect.top + rect.height
            ? rect.top + rect.height - top : pos.y - top;
        }

        if (this.dragBL || this.dragBR) {
          top = pos.y > rect.top
            ? rect.top : pos.y;
          height = pos.y > rect.top
            ? pos.y - top : rect.top - pos.y;
        }

        if (this.dragTR || this.dragBR) {
          left = pos.x > rect.left
            ? rect.left : pos.x;
          width = pos.x > rect.left
            ? pos.x - left : rect.left - left;
        }

        this.updateDragRectangle(
          left,
          top,
          width,
          height
        )
      }
    }

    if (this.dragRectangleIndex === null) {
      this.drawRectangles()
      this.drawReferences(pos);
    }
  }

  private getRectangleOnClick(x: number, y: number): number | null {
    let rectangleIndex: number | null = null;

    this.rectangles.some((rect: Rectangle, index) => {
      if (rect.visible) {
        if (
          x > rect.left - this.handleRadius
          && x < rect.left + this.handleRadius
          && y > rect.top - this.handleRadius
          && y < rect.top + this.handleRadius
        ) {
          this.dragTL = true;
          rectangleIndex = index;
          return true;
        } else if (
          x > rect.left + rect.width - this.handleRadius
          && x < rect.left + rect.width + this.handleRadius
          && y > rect.top - this.handleRadius
          && y < rect.top + this.handleRadius
        ) {
          this.dragTR = true;
          rectangleIndex = index;
          return true;
        } else if (
          x > rect.left - this.handleRadius
          && x < rect.left + this.handleRadius
          && y > rect.top + rect.height - this.handleRadius
          && y < rect.top + rect.height + this.handleRadius
        ) {
          this.dragBL = true;
          rectangleIndex = index;
          return true;
        } else if (
          x > rect.left + rect.width - this.handleRadius
          && x < rect.left + rect.width + this.handleRadius
          && y > rect.top + rect.height - this.handleRadius
          && y < rect.top + rect.height + this.handleRadius
        ) {
          this.dragBR = true;
          rectangleIndex = index;
          return true;
        } else if (
          x > rect.left
          && x < rect.left + rect.width
          && y > rect.top
          && y < rect.top + rect.height
        ) {
          this.dragWholeRect = true;
          rectangleIndex = index;
          return true;
        }
      }

      return false;
    })

    return rectangleIndex;
  }

  private drawRectangle(left: number, top: number, width: number, height: number, color: string) {
    const ctx = this.canvas!.getContext("2d")!;
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.lineWidth = this.rectangleLineWidth;
    ctx.fillStyle = color.replace(", 1)", `, ${this.rectangleOpacity})`);
    ctx.strokeStyle = color;
    ctx.rect(left, top, width, height);
    ctx.fill();
    ctx.stroke();
  }

  private drawHandles(left: number, top: number, width: number, height: number, color: string) {
    this.drawCircle(left, top, color);
    this.drawCircle(left + width, top, color);
    this.drawCircle(left + width, top + height, color);
    this.drawCircle(left, top + height, color);
  }

  private drawCircle(x: number, y: number, color: string): void {
    const ctx = this.canvas!.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, this.handleRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  private drawLabel(label: string, left: number, top: number, color: string) {
    const ctx = this.canvas!.getContext("2d")!;
    ctx.font = `${Math.round(this.baseFontSize * this.displayRatio)}px sans-serif`;

    const metrics = ctx.measureText(label);
    const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;

    ctx.fillStyle = color;
    ctx.fillRect(
      left + this.handleRadius,
      top - this.labelStickLength,
      this.labelStickWidth,
      this.labelStickLength
    );

    ctx.fillStyle = color;
    ctx.fillRect(
      left + this.handleRadius,
      top - this.labelStickLength - (fontHeight + this.labelPadding),
      metrics.width + this.labelPadding * 2,
      fontHeight + this.labelPadding
    );

    const colorObj = tinycolor(color);
    ctx.fillStyle = colorObj.isLight() ? "#000" : "#fff";
    ctx.fillText(label,
      left + this.handleRadius + this.labelPadding,
      top - this.labelStickLength - this.labelPadding
    );
  }

  private mouseLeave() {
    this.drawRectangles()
  }
}
