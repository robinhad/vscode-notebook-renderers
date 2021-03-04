// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { nbformat } from '@jupyterlab/coreutils';
import type { JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import { AudioPlayer } from './audioPlayer';
import { concatMultilineString } from './helpers';
import { fixMarkdown } from './markdownManipulation';
import { getTransform } from './transforms';

export interface ICellOutputProps {
    output: nbformat.IExecuteResult | nbformat.IDisplayData;
    mimeType: string;
}

export class CellOutput extends React.Component<ICellOutputProps> {
    constructor(prop: ICellOutputProps) {
        super(prop);
    }
    public render() {
        const mimeBundle = this.props.output.data as nbformat.IMimeBundle; // NOSONAR
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let data: nbformat.MultilineString | JSONObject = mimeBundle[this.props.mimeType!];

        // For un-executed output we might get text or svg output as multiline string arrays
        // we want to concat those so we don't display a bunch of weird commas as we expect
        // Single strings in our output
        if (Array.isArray(data)) {
            data = concatMultilineString(data as nbformat.MultilineString, true);
        }

        switch (this.props.mimeType) {
            case 'text/latex':
                return this.renderLatex(data);
            case 'image/png':
            case 'image/jpeg':
                return this.renderImage(mimeBundle, this.props.output.metadata);
            case 'text/html':
                return this.renderHTML(data, this.props.mimeType);
            default:
                return this.renderOutput(data, this.props.mimeType);
        }
    }
    /**
     * Custom rendering of image/png and image/jpeg to handle custom Jupyter metadata.
     * Behavior adopted from Jupyter lab.
     */
    private renderImage(mimeBundle: nbformat.IMimeBundle, metadata: Record<string, unknown> = {}) {
        const mimeType = 'image/png' in mimeBundle ? 'image/png' : 'image/jpeg';

        const imgStyle: Record<string, string | number> = {};
        const divStyle: Record<string, string | number> = { overflow: 'scroll' }; // This is the default style used by Jupyter lab.
        const imgSrc = `data:${mimeType};base64,${mimeBundle[mimeType]}`;

        if (typeof metadata.needs_background === 'string') {
            divStyle.backgroundColor = metadata.needs_background === 'light' ? 'white' : 'black';
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageMetadata = metadata[mimeType] as Record<string, any> | undefined;
        if (imageMetadata) {
            if (imageMetadata.height) {
                imgStyle.height = imageMetadata.height;
            }
            if (imageMetadata.width) {
                imgStyle.width = imageMetadata.width;
            }
            if (imageMetadata.unconfined === true) {
                imgStyle.maxWidth = 'none';
            }
        }

        // Hack, use same classes as used in VSCode for images (keep things as similar as possible).
        // This is to maintain consistently in displaying images (if we hadn't used HTML).
        // See src/vs/workbench/contrib/notebook/browser/view/output/transforms/richTransform.ts
        return (
            <div className={'display'} style={divStyle}>
                <img src={imgSrc} style={imgStyle}></img>
            </div>
        );
    }
    private renderOutput(data: nbformat.MultilineString | JSONObject, mimeType?: string) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unused-vars, no-unused-vars
        const Transform = getTransform(this.props.mimeType!);
        const divStyle: React.CSSProperties = {
            backgroundColor: mimeType && isAltairPlot(mimeType) ? 'white' : undefined
        };
        return (
            <div style={divStyle}>
                <Transform data={data} />
            </div>
        );
    }
    private renderLatex(data: nbformat.MultilineString | JSONObject) {
        // Fixup latex to make sure it has the requisite $$ around it
        data = fixMarkdown(concatMultilineString(data as nbformat.MultilineString, true), true);
        return this.renderOutput(data);
    }

    private renderHTML(data: nbformat.MultilineString | JSONObject, mimeType?: string): JSX.Element {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unused-vars, no-unused-vars
        const Transform = getTransform(this.props.mimeType!);
        const divStyle: React.CSSProperties = {
            backgroundColor: mimeType && isAltairPlot(mimeType) ? 'white' : undefined
        };

        // try to detect if node contains audio
        const element = document.createElement('div');
        element.innerHTML = String(data);
        const audioElements = element.getElementsByTagName('audio');
        if (audioElements.length >= 1) {
            const tracks = [];
            // scan for audio in nodes and extract them
            for (let i = 0; i < audioElements.length; i++) {
                const singleAudio = audioElements?.item(i)?.getElementsByTagName('source');
                if (singleAudio?.item(0)?.hasAttribute('src')) {
                    tracks.push(String(singleAudio?.item(i)?.src));
                }
            }
            return (
                <div style={divStyle}>
                    <Transform data={data} />
                    <h2>Extracted audio:</h2>
                    {tracks.map((track) => (
                        <AudioPlayer audio={track}></AudioPlayer>
                    ))}
                </div>
            );
        } else {
            return (
                <div style={divStyle}>
                    <Transform data={data} />
                </div>
            );
        }
    }
}

function isAltairPlot(mimeType: string) {
    return mimeType.includes('application/vnd.vega');
}
