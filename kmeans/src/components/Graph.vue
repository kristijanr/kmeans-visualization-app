<template>
    <div id="container"></div>

    <div class="inputs">
        <v-switch v-model="displayVoronoi" label="Display Voronoi borders"
            :color="displayVoronoi ? 'primary' : 'error'"></v-switch>

        <v-text-field v-model="clusterAmount" label="Amount of clusters" :rules="rules" />

        <v-text-field v-model="dataPointsAmount" label="Amount of data points" :rules="rules" />

        <v-text-field v-model="iterationAmount" label="Maximum amount of iterations" :rules="rules" />

        <v-select v-model="distribution" label="Select data distribution" :items="distributionOptions"></v-select>
        <v-text-field v-if="isCircularData" v-model="circleAmount" label="Amount of circles" :rules="rules" />

        <div class="buttons">
            <v-btn variant="outlined" color="green" @click="start" :disabled="isRunning"> Start </v-btn>

            <v-btn variant="outlined" color="red" @click="stop" :disabled="!isRunning"> Stop </v-btn>

            <v-btn variant="outlined" color="primary" @click="reset"> Reset </v-btn>
        </div>

        <v-snackbar v-model="toast" :timeout="timeout">
            {{ toastMessage }}

            <template v-slot:actions>
                <v-btn color="black" variant="text" @click="showHideToast">
                    Close
                </v-btn>
            </template>
        </v-snackbar>
    </div>
</template>

<script>
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import {
    initializeRandomData,
    initializeCentroids,
    svgAttributes,
    nearestCentroid,
    average,
    initializeCircularData
} from "../utils/kmeans-helpers.js";
import { debounce } from 'lodash';

const DEFAULT_DATA_AMOUNT = 100;
const DEFAULT_CLUSTER_AMOUNT = 3;
const DEFAULT_ITERATION_AMOUNT = 10;
const CONVERGENCE_THRESHOLD = 0.001;
const DEFAULT_DISTRIBUTION = 'Random'
const COLOUR = d3.scaleOrdinal(d3.schemeCategory10);

const DEFAULT_CIRCLES_AMOUNT = 3;

export default {
    data() {
        return {
            centroids: [],
            dataPoints: [],
            previousCentroids: [],

            //Needed DOM elements
            domNodes: null,
            domCentroids: null,

            //Inputs Binding
            clusterAmount: DEFAULT_CLUSTER_AMOUNT,
            dataPointsAmount: DEFAULT_DATA_AMOUNT,
            iterationAmount: DEFAULT_ITERATION_AMOUNT,
            distribution: DEFAULT_DISTRIBUTION,
            circleAmount: DEFAULT_CIRCLES_AMOUNT,
            displayVoronoi: false,

            iterationHelper: null,

            // Properties needed for graph drawing
            graphContainer: null,
            linearDomain: null,
            xLinearScale: null,
            yLinearScale: null,

            //Input rules
            rules: [
                inputValue => !!inputValue || 'Required',
                inputValue => (inputValue && !isNaN(parseInt(inputValue))) || 'Input must be an Integer'
            ],

            //Interval for interval running
            interval: null,

            // Toast message
            toast: false,
            toastMessage: null,
            toastTimeout: 2000
        }
    },

    computed: {
        isConverged() {
            for (let i = 0; i < this.centroids.length; i++) {
                const current = this.centroids[i];
                const previous = this.previousCentroids[i];

                if (Math.abs(current.x - previous.x) > CONVERGENCE_THRESHOLD ||
                    Math.abs(current.y - previous.y) > CONVERGENCE_THRESHOLD) {

                    return false;
                }
            }
            return true;
        },

        isRunning() {
            return this.interval ? true : false;
        },

        distributionOptions() {
            return ['Random', 'Circular'];
        },

        isCircularData() {
            return this.distribution === 'Circular';
        },
    },
    watch: {
        'dataPointsAmount'(value) {
            // After input change, call the re-draw function after 500ms
            this.dataPointsAmount = value;
            this.onDataPointAmountChange();
        },

        'clusterAmount'(value) {
            // After input change, call the re-draw function after 500ms
            this.clusterAmount = value;
            this.onClusterAmountChange();
        },

        'iterationAmount'(value) {
            this.iterationHelper = value;
        },

        'displayVoronoi'(value) {
            this.displayVoronoi = value;
            this.drawVoronoi();
        },

        'distribution'() {
            this.onDistributionChange();
        },

        'circleAmount'() {
            this.onCircleAmountChange();
        }
    },

    beforeMount() {
        // Initial data
        this.initData(this.clusterAmount, this.dataPointsAmount);

        //Setting up inital scaling and domain
        this.initScale();

        //Initially set up the iteration helper
        this.iterationHelper = this.iterationAmount;
    },

    mounted() {
        this.drawGraph();
        this.drawAxis();
        this.drawDataPoints();
        this.drawCentroids();
    },

    methods: {
        initData(clusterCount = DEFAULT_CLUSTER_AMOUNT, dataPointsCount = DEFAULT_DATA_AMOUNT, distribution = DEFAULT_DISTRIBUTION) {
            const centroids = initializeCentroids(clusterCount, dataPointsCount);
            let data = [];


            if (distribution === 'Random') {
                data = initializeRandomData(dataPointsCount);
            }

            if (distribution === 'Circular') {
                data = initializeCircularData(dataPointsCount, this.circleAmount || DEFAULT_CIRCLES_AMOUNT)
            }

            this.centroids = centroids;
            this.dataPoints = data;
        },

        initScale() {

            this.linearDomain = [0, this.dataPointsAmount];

            this.xLinearScale = d3.scaleLinear().domain(this.linearDomain).range([0, svgAttributes.width]);
            this.yLinearScale = d3.scaleLinear().domain(this.linearDomain).range([svgAttributes.height, 0]);
        },

        drawGraph() {
            this.graphContainer = d3.select('#container')
                .append('svg')
                .attr('viewBox', `${svgAttributes.x} ${svgAttributes.y} ${svgAttributes.height} ${svgAttributes.width}`)
                .attr('width', `${svgAttributes.width}`)
                .attr('height', `${svgAttributes.height}`)
                .append('g')
                .attr('transform', 'translate(-10, 50)')
                .attr('color', '#e6e8ea')
                .attr('stroke-width', 4);

        },

        drawAxis() {
            this.graphContainer.selectAll('g').remove(); // Remove any previous ticks before drawing axis

            // Draw X axis
            this.graphContainer.append('g')
                .attr('transform', `translate(0, ${svgAttributes.height})`)
                .call(d3.axisBottom(this.xLinearScale).tickPadding(10).ticks(this.dataPointsAmount / (this.clusterAmount ** 2)))
                .attr('font-size', '18px')
                .attr('font-weight', 'bold');

            // Draw Y axis
            this.graphContainer.append('g')
                .call(d3.axisLeft(this.yLinearScale).tickPadding(10).ticks(this.dataPointsAmount / (this.clusterAmount ** 2)))
                .attr('font-size', '18px')
                .attr('font-weight', 'bold');
        },

        drawDataPoints() {
            // Remove previous nodes
            this.graphContainer.selectAll('#nodes').remove();

            this.graphContainer.append('g')
                .attr('id', 'nodes')
                .selectAll('circle')
                .data(this.dataPoints)
                .enter()
                .append('circle')
                .attr('class', 'node')
                .attr('cx', (node) => this.xLinearScale(node.x))
                .attr('cy', (node) => this.yLinearScale(node.y))
                .attr('r', 6)
                .attr('stroke', '#e6e8ea')
                .attr('stroke-width', 2)
                .attr('fill', (node) => COLOUR(node.cluster));

            this.domNodes = d3.selectAll('.node');
        },

        drawCentroids() {
            // Remove previous centroids
            this.graphContainer.selectAll('#centroids').remove();

            this.graphContainer.append('g')
                .attr('id', 'centroids')
                .selectAll('circle')
                .data(this.centroids)
                .enter()
                .append('circle')
                .attr('class', 'centroid')
                .attr('cx', (centroid) => this.xLinearScale(centroid.x))
                .attr('cy', (centroid) => this.yLinearScale(centroid.y))
                .attr('r', 10)
                .attr('stroke', 'white')
                .attr('stroke-width', 4)
                .attr('fill', (_, index) => COLOUR(index));

            this.domCentroids = d3.selectAll('.centroid');
        },

        drawVoronoi() {
            this.graphContainer.selectAll('.voronoi').remove(); // Remove previous Voronoi cells

            let voronoi = d3.Delaunay
                .from(this.centroids, c => this.xLinearScale(c.x), c => this.yLinearScale(c.y))
                .voronoi([0, 0, svgAttributes.width, svgAttributes.height]);

            this.graphContainer.selectAll('.voronoi')
                .data(voronoi.cellPolygons())
                .enter()
                .append('path')
                .attr('class', 'voronoi')
                .attr('stroke', this.displayVoronoi ? 'red' : 'none') // if we should display voronoi, apply the red stroke, else no stroke
                .attr('stroke-width', '2px')
                .attr('fill', 'none')
                .attr('d', d => `M${d.join('L')}Z`)
        },

        updateClusters() {

            this.dataPoints.forEach((dataPoint) => {
                dataPoint.cluster = nearestCentroid(dataPoint, this.centroids);

                this.domNodes.style('fill', n => COLOUR(n.cluster));
            });
        },

        updateCentroids() {
            this.centroids.forEach((centroid, index) => {
                const cluster = this.dataPoints.filter((node) => node.cluster === index);

                if (cluster.length) {
                    centroid.x = average(cluster.map(node => node.x));
                    centroid.y = average(cluster.map(node => node.y));
                }
            });

            this.domCentroids
                .transition().duration(500)
                .attr('cx', c => this.xLinearScale(c.x))
                .attr('cy', c => this.yLinearScale(c.y));
        },

        start() {
            this.previousCentroids = this.centroids.map(c => ({ x: c.x, y: c.y }));
            this.updateClusters();
            this.drawVoronoi();

            this.interval = setInterval(() => {
                if (this.iterationHelper <= 0) {
                    clearInterval(this.interval);
                    this.interval = null;

                    this.toastMessage = 'Reached maximum iterations';
                    this.showHideToast();

                    return;
                }

                this.updateCentroids();
                this.updateClusters();
                this.drawVoronoi();

                if (this.isConverged) {
                    clearInterval(this.interval);
                    this.interval = null;

                    this.toastMessage = `Converged after ${this.iterationAmount - this.iterationHelper} iterations`;
                    this.showHideToast();

                    return;
                }

                this.previousCentroids = this.centroids.map(c => ({ x: c.x, y: c.y }));
                this.iterationHelper--;
            }, 3000);
        },

        stop() {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;

                this.toastMessage = 'Stopped';
                this.showHideToast();
            }
        },

        reset() {
            clearInterval(this.interval);
            this.interval = null;

            this.initData(this.clusterAmount, this.dataPointsAmount, this.distribution);

            this.domNodes = this.graphContainer.select('#nodes')
                .selectAll('.node')
                .data(this.dataPoints)
                .join(
                    enter => enter.append('circle')
                        .attr('class', 'node')
                        .attr('cx', (node) => this.xLinearScale(node.x))
                        .attr('cy', (node) => this.yLinearScale(node.y))
                        .attr('r', 5)
                        .attr('stroke', 'white')
                        .attr('stroke-width', 2)
                        .attr('fill', (node) => COLOUR(node.cluster)),
                    update => update.transition().duration(500)
                        .attr('cx', (node) => this.xLinearScale(node.x))
                        .attr('cy', (node) => this.yLinearScale(node.y))
                        .style('fill', (node) => COLOUR(node.cluster)),
                    exit => exit.remove()
                );

            this.domCentroids = this.graphContainer.select('#centroids')
                .selectAll('.centroid')
                .data(this.centroids)
                .join(
                    enter => enter.append('circle')
                        .attr('class', 'centroid')
                        .attr('cx', (centroid) => this.xLinearScale(centroid.x))
                        .attr('cy', (centroid) => this.yLinearScale(centroid.y))
                        .attr('r', 10)
                        .attr('stroke', 'white')
                        .attr('stroke-width', 4)
                        .attr('fill', (_, index) => COLOUR(index)),
                    update => update.transition().duration(500)
                        .attr('cx', (centroid) => this.xLinearScale(centroid.x))
                        .attr('cy', (centroid) => this.yLinearScale(centroid.y)),
                    exit => exit.remove()
                );

            this.drawVoronoi();
        },

        showHideToast() {
            this.toast = !this.toast;
        },
        // Debounced (delayed) functions
        onDataPointAmountChange: debounce(function () {
            this.initData(this.clusterAmount, this.dataPointsAmount);
            this.initScale();
            this.drawAxis();
            this.drawVoronoi();

            this.drawCentroids();
            this.drawDataPoints();
        }, 500),

        onClusterAmountChange: debounce(function () {
            this.initData(this.clusterAmount, this.dataPointsAmount);
            this.drawVoronoi();

            this.drawCentroids();
            this.drawDataPoints();
        }, 500),

        onDistributionChange: debounce(function () {
            this.initData(this.clusterAmount, this.dataPointsAmount, this.distribution);
            this.drawVoronoi();

            this.drawCentroids();
            this.drawDataPoints();
        }, 500),

        onCircleAmountChange: debounce(function () {
            this.initData(this.clusterAmount, this.dataPointsAmount, this.distribution);
            this.drawVoronoi();

            this.drawCentroids();
            this.drawDataPoints();
        }, 500),

    }
}
</script>

<style scoped>
.inputs {
    display: flex;
    flex-direction: column;
    width: 300px;

    margin-left: 15vh;
}

.buttons {
    display: flex;
    justify-content: space-between;
}
</style>
