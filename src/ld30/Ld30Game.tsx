import { useEffect, useRef, useState } from "react";
import * as ex from "excalibur";
import { validateLd30Assets } from "./assets";
import "./Ld30Game.css";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CANVAS_BG = new ex.Color(82, 62, 41);

export function Ld30Game() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading",
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const engineRef = useRef<ex.Engine | null>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }

        let cancelled = false;

        const bootstrapEngine = () => {
            try {
                validateLd30Assets();

                const canvas = document.createElement("canvas");
                canvas.width = CANVAS_WIDTH;
                canvas.height = CANVAS_HEIGHT;
                canvas.classList.add("ld30-canvas");
                canvas.setAttribute("aria-label", "Marble Run game canvas");

                host.replaceChildren(canvas);

                const engine = new ex.Engine({
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    antialiasing: false,
                    backgroundColor: CANVAS_BG,
                    canvasElement: canvas,
                    suppressPlayButton: true,
                });

                engineRef.current = engine;
                engine.start();

                if (!cancelled) {
                    setStatus("ready");
                    setErrorMessage(null);
                }
            } catch (error) {
                if (!cancelled) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "LD30 assets failed to load.";
                    setStatus("error");
                    setErrorMessage(message);
                }
            }
        };

        bootstrapEngine();

        return () => {
            cancelled = true;
            const engine = engineRef.current;
            if (engine) {
                engine.stop();
                engine.dispose();
                engineRef.current = null;
            }
            host.replaceChildren();
        };
    }, []);

    return (
        <div
            className="ld30-game"
            tabIndex={0}
            aria-label="Marble Run game stage"
        >
            <div ref={hostRef} className="ld30-canvas-shell" />
            <div className="ld30-stage-status" aria-live="polite">
                {status === "loading" && "Loading Marble Run…"}
                {status === "ready" && "Keyboard required • Arrows / WASD"}
                {status === "error" &&
                    (errorMessage ?? "Asset loading failed. Refresh to retry.")}
            </div>
        </div>
    );
}
