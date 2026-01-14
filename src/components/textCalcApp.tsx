import { evaluate, format, MathType, create, all } from 'mathjs';
import { Textarea } from "@/components/ui/textarea";
import { useState } from 'react';
import { Configs } from '@/conf';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

// 创建高精度 mathjs 实例
const math = create(all, {
  number: 'BigNumber',
  precision: 64
});

export function TextCalcApp() {
    const [lines, setLines] = useState<{ input: string; result: string[] }>(() => {
        const savedInput = localStorage.getItem('calcInput') || '';
        return {
            input: savedInput,
            result: savedInput ? calculateResults(savedInput) : []
        };
    });
    const [copiedLineIndex, setCopiedLineIndex] = useState<number | null>(null);
    const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

    const handleInputChange = (value: string) => {
        const resArray = calculateResults(value)
        setLines({ input: value, result: resArray });
        localStorage.setItem('calcInput', value);
    };
    
    const handleCopy = (textToCopy: string, index: number) => {
        if (!textToCopy.trim()) return;
        const resultPart = textToCopy
        navigator.clipboard.writeText(resultPart).then(() => {
            setCopiedLineIndex(index);
            setTimeout(() => {
                setCopiedLineIndex(null);
            }, 2000);
        }).catch(err => {
            console.error('无法复制文本: ', err);
        });
    };
    
    return (
        <div className="container mx-auto p-4 grid grid-cols-2 gap-4 ">
            <div className="flex flex-col space-y-2 ">
                <Textarea
                    value={lines.input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={Configs.DefaultTxt}
                    className="w-full min-h-[calc(90vh-1rem)] md:text-2xl font-mono leading-8"
                />
            </div>
            
            <div className="flex flex-col space-y-2">
                <div className="w-full min-h-[calc(90vh-1rem)] font-bold md:text-2xl font-mono leading-8 px-3 py-2 border bg-background rounded-md overflow-y-auto">
                    {lines.result.map((line, index) => (
                        <div
                            key={index}
                            className="group flex justify-between items-center h-8" 
                        >
                            <pre className="font-bold">
                                <span className={`transition-colors duration-150 rounded px-1 ${
                                    hoveredLineIndex === index ? 'bg-muted' : 'bg-transparent'
                                }`}>
                                    {line || <>&nbsp;</>}
                                </span>
                            </pre>
                            {line.trim() && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleCopy(line, index)}
                                    onMouseEnter={() => setHoveredLineIndex(index)}
                                    onMouseLeave={() => setHoveredLineIndex(null)}
                                >
                                    {copiedLineIndex === index ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">复制此行</span>
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const calculateResults = (value: string): string[] => {
    const inputLines = value.split('\n');
    const resultLines = [];
    for (const line of inputLines) {
        const { lineWithoutComment, comment } = HandleOneLine(line);
        if (lineWithoutComment === "") {
            resultLines.push(comment ? `# ${comment}` : '');
            continue;
        }
        if (/^\d+(\.\d+)?$/.test(lineWithoutComment)) {
            resultLines.push(lineWithoutComment);
            continue;
        }
        let result = GetLineNoCommentResult(lineWithoutComment);
        if (comment) {
            result += `    # ${comment}`;
        }
        resultLines.push(result);
    }
    return resultLines;
};

function formatEvalResultNumber(evalResult: number, needPercent: boolean): string {
    if (Number.isInteger(evalResult)) return evalResult.toString();

    // 获取小数部分
    const decimalPart = evalResult.toString().split('.')[1] || '';
    const decimalLength = decimalPart.length;
    
    let formatted: string;
    
    if (decimalLength <= 10) {
        // 使用 mathjs 的 bignumber 避免浮点误差
        const bnResult = math.bignumber(evalResult);
        formatted = math.format(bnResult, { notation: 'fixed', precision: Math.min(decimalLength, 12) });
        // 移除末尾的0
        formatted = parseFloat(formatted).toString();
    } else {
        // 小数位数多，最多保留10位
        const bnResult = math.bignumber(evalResult);
        formatted = math.format(bnResult, { notation: 'fixed', precision: 10 });
        formatted = parseFloat(formatted).toString();
    }
    
    // 股票涨跌幅显示优化
    if (Configs.ShowNumPercentDetail && needPercent && evalResult < 1.3 && evalResult > 0.7) {
        const temp = format(evalResult * 100 - 100, { notation: 'fixed', precision: 2 });
        const fix = evalResult > 1 ? "+" : "";
        const percent = fix + parseFloat(temp).toString() + "%";
        formatted = `${formatted} (${percent})`;
    }
    
    return formatted;
}

function formatEvalResult(evalResult: MathType, needPercent: boolean): string {
    if (typeof evalResult === 'number') {
        return formatEvalResultNumber(evalResult, needPercent);
    } else if (typeof evalResult === 'string') {
        return evalResult;
    } else if (evalResult && typeof evalResult === 'object') {
        // 处理 mathjs 对象
        if ('isBigNumber' in evalResult) {
            // BigNumber
            const numValue = (evalResult as any).toNumber();
            return formatEvalResultNumber(numValue, needPercent);
        } else if ('type' in evalResult) {
            if (evalResult.type === 'Complex') {
                return format(evalResult, { notation: 'auto' });
            } else if (evalResult.type === 'BigNumber') {
                const numValue = (evalResult as any).toNumber();
                return formatEvalResultNumber(numValue, needPercent);
            } else if (evalResult.type === 'Unit') {
                return format(evalResult);
            } else {
                return format(evalResult);
            }
        }
    }
    return "";
}

function HandleOneLine(line: string) {
    const trimmedLine = line.trim();
    const commentMatch = trimmedLine.match(/#\s*(.+)/);
    let comment = '';
    if (commentMatch) {
        comment = commentMatch[1];
    }
    const lineWithoutComment = trimmedLine.replace(/#.*/, '').trim();
    return { lineWithoutComment, comment };
}

function GetLineNoCommentResult(inpLine: string) {
    let result = '';
    const lineForCalc = inpLine.replaceAll('x', '*');

    if (inpLine.includes('a') && inpLine.includes('=')) {
        try {
            result = solveEquation(lineForCalc);
            result = `a = ${result}`;
        } catch (error) {
            result = `${inpLine}  # 方程求解失败, 请检查方程的格式`;
        }
        return result;
    }

    try {
        const needPercent = lineForCalc.includes('/');
        // 使用 math.evaluate 进行高精度计算
        const evalResult = math.evaluate(lineForCalc);
        const formattedResult = formatEvalResult(evalResult, needPercent);
        result = `${inpLine} = ${formattedResult}`; 
    } catch (error: any) {
        result = `${inpLine}`;
    }
    return result;
}

function solveEquation(equation: string): string {
    const parts = equation.split('=');
    if (parts.length !== 2) {
        throw new Error("方程格式不正确，应为 '表达式=表达式'");
    }
    const [left, right] = parts;

    const f = (a: number): number => {
        const leftFunc = new Function("a", "return " + left);
        const rightFunc = new Function("a", "return " + right);
        return leftFunc(a) - rightFunc(a);
    };

    const f0 = f(0);
    const f1 = f(1);
    const coeff = f1 - f0;

    if (coeff === 0) {
        if (f0 === 0) return "Infinite solutions";
        else return "No solution";
    }

    const result = -f0 / coeff;
    const decimalPart = result.toString().split('.')[1] || '';
    const decimalLength = decimalPart.length;
    
    if (decimalLength > 10) {
        return result.toFixed(10);
    }
    
    return result.toString();
}
