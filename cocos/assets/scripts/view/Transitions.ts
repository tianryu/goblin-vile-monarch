/** 所有显隐从当前透明度接续，淡出立即停止输入，动画只维护显示数值。 */
export class Visibility {
    value = 0;
    target = 0;
    set(visible: boolean): void { this.target = visible ? 1 : 0; }
    tick(dt: number): number {
        const speed = this.target > this.value ? 5.8 : 7.2;
        const delta = this.target - this.value;
        this.value += Math.sign(delta) * Math.min(Math.abs(delta), dt * speed);
        return this.value;
    }
    get interactive(): boolean { return this.target > 0 && this.value > .5; }
}
