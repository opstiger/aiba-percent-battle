/* p5.brush 以 ES 模块源码加载，额外暴露 flush()：
   库里笔触是"换颜色才落到画布"的延迟合成，需要手动落笔来控制原生绘制和笔刷的前后层级。 */
import * as B from "../.deps/node_modules/p5.brush/src/index.p5.js";
import { flushActiveComposite } from "../.deps/node_modules/p5.brush/src/core/color.js";
window.brush = Object.assign({}, B, { flush: flushActiveComposite });
