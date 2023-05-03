let sankeyData = {links: [],nodes: [],order: []}
let sankeyLayout
let sankeyDiagram
let activeScenario = 0
let scaleInit = 1
let sankeyCanvas
let headerCanvas
let footerCanvas
let autoPlayStatus = false
let autoPlayTimer
let zoomHasInitialized = false
let nodesGlobal

setTimeout(() => {
  sankeyfy({
    mode: 'xlsx',
    xlsxURL: 'data/CBSEnergieBalans.xlsx',
    // xlsxURL: 'data/II3050.xlsx',
    targetDIV: 'mainContainer',
    margins: {vertical: 120,horizontal: 200}, // margins is not referenced in xlsx mode
    sankeyData: null, // not referenced in xlsx mode, format in accordance with sankey data object format
    legend: null, //  not referenced in xlsx mode, format in accordance with legend format as implemented in xlsx example file
    settings: null // not reference in xlsx mode. format in accordance with legend format as implementd thorugh xlsx route 
  })
}, 100)

function sankeyfy (config) {
  switch (config.mode) {
    case 'xlsx':
      process_xlsx(config)
      break
    case 'object':
      process_object(config)
      break
    default:
      console.log('WARNING - unknown plot mode')
      break
  }

  function process_xlsx (config) {
    console.log('sankeyfy - XLSX mode')
    readExcelFile(config.xlsxURL, (links, nodes, legend, settings) => {
      console.log('Links:', links)
      console.log('Nodes:', nodes)
      console.log('Legend:', legend)
      console.log('Settings:', settings)

      nodesGlobal = nodes

      config.settings = settings
      config.legend = legend

      console.log(links)
      let scaleValues = settings[0].scaleDataValue
      for (i = 0;i < links.length;i++) {
        Object.keys(links[i]).forEach(key => {
          if (typeof links[i][key] == 'number') {
            links[i][key] = links[i][key] / scaleValues
          }
        })
      }

      let maxColumn = 0
      // generate order object
      nodes.forEach(element => {
        if (element.column > maxColumn) {maxColumn = element.column}
      })
      let columnLength = maxColumn + 1
      for (i = 0;i < columnLength;i++) {
        sankeyData.order.push([[]])
      }
      for (i = 0;i < nodes.length;i++) {
        for (j = 0;j < sankeyData.order.length;j++) {
          if (nodes[i].column == j) {
            if (sankeyData.order[j].length == 0) {sankeyData.order[j].push([])}
            for (k = 0; k < nodes[i].cluster;k++) {
              if (!(sankeyData.order[j].includes(k))) {
                sankeyData.order[j].push([])
              }
            }
            if (sankeyData.order[j][nodes[i].cluster].length == 0) {sankeyData.order[j][nodes[i].cluster].push([])}
            for (k = 0;k < nodes[i].row;k++) {
              if (!(sankeyData.order[j][nodes[i].cluster].includes(k))) {
                sankeyData.order[j][nodes[i].cluster].push([])
              }
            }
            sankeyData.order[j][nodes[i].cluster][nodes[i].row].push(nodes[i].id)
          }
        }
      }
      // generate nodes object
      for (i = 0;i < nodes.length;i++) {
        sankeyData.nodes.push({title: nodes[i].title, id: nodes[i].id, direction: nodes[i].direction, index: i, dummy: nodes[i].dummy, x: nodes[i].x, y: nodes[i].y})
      }

      // generate scenario object
      let scenarios = []
      let counter = 0
      for (s = 0;s < Object.keys(links[0]).length;s++) {
        if (Object.keys(links[0])[s].includes('scenario')) {
          if (counter < 10) {
            scenarios.push({title: Object.keys(links[0])[s].slice(10), id: Object.keys(links[0])[s]}) // NOTE: maximum number of allowed scenarios is 100 in this setup
          }else {
            scenarios.push({title: Object.keys(links[0])[s].slice(11), id: Object.keys(links[0])[s]})
          }
          counter++
        }
      }

      config.scenarios = scenarios
      // generate links object
      for (i = 0;i < links.length;i++) {
        sankeyData.links.push({index: i, source: links[i]['source.id'], target: links[i]['target.id'], color: getColor(links[i]['legend'], legend), value: links[i].value, type: links[i].type, legend: links[i]['legend']})
        scenarios.forEach(element => {
          sankeyData.links[i][element.id] = links[i][element.id]
        })
      }

      adaptTotalHeight = config.settings[0].adaptTotalHeight

      let width = document.getElementById(config.targetDIV).offsetWidth
      let height = document.getElementById(config.targetDIV).offsetHeight

      sankeyLayout = d3.sankey().extent([[settings[0].horizontalMargin, settings[0].verticalMargin], [width - settings[0].horizontalMargin, height - settings[0].verticalMargin]])
      sankeyDiagram = d3.sankeyDiagram().nodeTitle(function (d) { return d.title }).linkColor(function (d) { return d.color }) // return d.title || d.id

      drawSankey(sankeyData, legend, config)
    })
  }

  function process_object (config) {
    console.log('sankeyfy - OBJECT mode')

    sankeyData = config.sankeyData

    sankeyLayout = d3.sankey().extent([[config.margins.horizontal, config.margins.vertical], [width - config.margins.horizontal, height - config.margins.vertical]])
    sankeyDiagram = d3.sankeyDiagram().nodeTitle(function (d) { return d.title }).linkColor(function (d) { return d.color }) // return d.title || d.id

    drawSankey(config, config.sankeyData, config.legend)
  }

  function drawSankey (sankeyData, legend, config) {
    d3.select('#sankeySVG').remove()

    assetslog = {}

    let scrollExtentWidth = config.settings[0].scrollExtentWidth
    let scrollExtentHeight = config.settings[0].scrollExtentHeight

    let viewportWidth = document.getElementById(config.targetDIV).offsetWidth
    let viewportHeight = document.getElementById(config.targetDIV).offsetHeight

    // create DIV structure
    // header
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_header').attr('class', 'header').style('position', 'absolute').style('top', '0px').style('left', '0px').style('right', '0px').style('overflow', 'hidden').style('height', '70px').style('width', '100%').append('svg').attr('id', config.targetDIV + '_headerSVG').attr('width', viewportWidth).attr('height', 70)
    // content wrapper
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_content-wrapper').style('position', 'relative').style('top', '70px').style('left', '0px').style('overflow', 'hidden').style('width', '100%').style('height', 'calc(100% - 130px)')
    // content
    d3.select('#' + config.targetDIV + '_content-wrapper').append('div').attr('id', 'content').style('width', viewportWidth + 'px').style('min-height', 'calc(100% - 130px)').style('height', viewportHeight + 'px').style('background-color', '')
    // footer
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_footer').attr('class', 'footer').style('height', '60px').style('width', '100%').style('position', 'absolute').style('bottom', '0px').style('left', '0px').style('overflow', 'hidden').append('svg').attr('id', config.targetDIV + '_footerSVG').attr('width', viewportWidth).attr('height', 100)
    // buttons
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_buttons').attr('class', 'buttons').style('height', '70px').style('width', '100%').style('position', 'absolute').style('top', '70px').style('left', '0px').style('overflow', 'hidden').append('svg').attr('id', config.targetDIV + '_buttonsSVG').attr('width', viewportWidth).attr('height', 70).style('background-color', 'none')
    // append SVGS
    d3.select('#content').append('svg').style('position', 'absolute').style('top', '0px').style('left', '0px').attr('id', 'sankeySVGbackdrop').attr('width', viewportWidth + 'px').attr('height', viewportHeight + 'px').style('pointer-events', 'none')
    d3.select('#content').append('svg').style('position', 'absolute').attr('id', 'sankeySVGPARENT').attr('width', scrollExtentWidth + 'px').attr('height', scrollExtentHeight + 'px').style('pointer-events', 'none').append('g').attr('id', 'sankeySVG').style('pointer-events', 'all') // scrollExtentWidth

    // d3.select('#sankeySVG').style('transform-origin', '0px 0px')
    backdropCanvas = d3.select('#sankeySVGbackdrop')
    sankeyCanvas = d3.select('#sankeySVG')
    headerCanvas = d3.select('#' + config.targetDIV + '_headerSVG').append('g')
    footerCanvas = d3.select('#' + config.targetDIV + '_footerSVG').append('g')
    buttonsCanvas = d3.select('#' + config.targetDIV + '_buttonsSVG').append('g')
    parentCanvas = d3.select('#sankeySVGPARENT').append('g')

    sankeyCanvas.append('rect').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#ddd').style('opacity', 0.001)
    backdropCanvas.append('rect').attr('id', 'backDropCanvasFill').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#ddd').attr('fill', 'url(#dots)')

    window.addEventListener('resize', function (event) {
      d3.select('#backDropCanvasFill').attr('width', document.getElementById(config.targetDIV).offsetWidth).attr('height', document.getElementById(config.targetDIV).offsetWidth)
      d3.select('#sankeySVGbackdrop').attr('width', document.getElementById(config.targetDIV).offsetWidth).attr('height', document.getElementById(config.targetDIV).offsetWidth)
    })

    parentCanvas.append('text').attr('x', 35).attr('y', 120).attr('fill', '#444').style('opacity', 0.6).style('font-size', '30px').text('-').attr('id', 'scenarioIndicator')

    parentCanvas.append('rect').attr('id', 'popupBlinder').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#333').style('opacity', 0.5).style('visibility', 'hidden').style('pointer-events', 'all')
      .on('click', function () {
        d3.select('#nodeInfoPopup').remove()
        d3.select('#nodeInfoPopup').remove()
        d3.select('#popupBlinder').style('visibility', 'hidden')
        d3.select('#popupBlinder').style('pointer-events', 'none')
      })

    // let currentK = config.settings[0].initTransformK
    function zoomed ({ transform }) {
      const initX = parseFloat(config.settings[0].initTransformX)
      const initY = parseFloat(config.settings[0].initTransformY)
      const initK = parseFloat(config.settings[0].initTransformK)
      var adjustedTransform = d3.zoomIdentity.translate(initX + transform.x, initY + transform.y).scale(initK * transform.k)
      d3.select('#sankeySVG').attr('transform', adjustedTransform)
    }

    function initZoom () {
      d3.select('#sankeySVGPARENT').call(d3.zoom()
        .extent([[0, 0], [document.getElementById('sankeySVGPARENT').getAttribute('width').slice(0, -2), document.getElementById('sankeySVGPARENT').getAttribute('height').slice(0, -2)]])
        .scaleExtent([0.5, 8])
        .on('zoom', zoomed)
      )
      const initX = parseFloat(config.settings[0].initTransformX)
      const initY = parseFloat(config.settings[0].initTransformY)
      const initK = parseFloat(config.settings[0].initTransformK)
      var initTransform = d3.zoomIdentity.translate(initX, initY).scale(initK)
      console.log(initTransform)
      // zoomed(initTransform)
      d3.select('#sankeySVG').attr('transform', initTransform)
    }

    initZoom()

    d3.select('.sankey').select('.links').selectAll('.link').attr('id', function (d) {console.log(d)})

    // draw scenario buttons
    let spacing = 7
    let cumulativeXpos = 45

    if (config.settings[0].scenarioButtons == 'ja') {
      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('x', 31).attr('y', 17).attr('rx', 5).attr('ry', 5).attr('fill', '#333')
        .on('click', function () {
          console.log(autoPlayStatus)
          if (autoPlayStatus) {
            clearInterval(autoPlayTimer)
            autoPlayStatus = false
            d3.select('#playStateIconPlay').style('visibility', 'visible')
            d3.select('#playStateIconStop').style('visibility', 'hidden')
          } else {
            autoPlayStatus = true
            d3.select('#playStateIconPlay').style('visibility', 'hidden')
            d3.select('#playStateIconStop').style('visibility', 'visible')
            d3.selectAll('#playStateIcon').remove()

            if (activeScenario > config.scenarios.length - 2) {
              activeScenario = 0
              setScenario(activeScenario)
            } else {
              // activeScenario = activeScenario + 1
              setScenario(activeScenario)
            }
            autoPlayTimer = setInterval(() => {
              if (activeScenario > config.scenarios.length - 1) {
                activeScenario = 0
              } else {
                setScenario(activeScenario)
                activeScenario++}
            }, 1000)
          }
        })
      buttonsCanvas.append('path').attr('id', 'playStateIconPlay').attr('d', 'M5.92 24.096q0 1.088 0.928 1.728 0.512 0.288 1.088 0.288 0.448 0 0.896-0.224l16.16-8.064q0.48-0.256 0.8-0.736t0.288-1.088-0.288-1.056-0.8-0.736l-16.16-8.064q-0.448-0.224-0.896-0.224-0.544 0-1.088 0.288-0.928 0.608-0.928 1.728v16.16z').attr('transform', 'translate(36,21) scale(1)').attr('fill', '#FFF').style('pointer-events', 'none').style('visibility', 'visible')
      buttonsCanvas.append('rect').attr('id', 'playStateIconStop').attr('x', 41.5).attr('y', 28).attr('width', 18).attr('height', 18).attr('dx', 3).attr('dy', 3).attr('fill', '#FFF').style('pointer-events', 'none').style('visibility', 'hidden')

      for (i = 0;i < config.scenarios.length;i++) {
        // var buttonWidth = getTextWidth(config.scenarios[i].title, '16px', config.settings[0].font) + 20
        var buttonWidth = 40
        var buttonHeight = 40
        var rotateAngle = -45 // set the rotation angle here
        var x = config.settings[0].scenarioButtonsPositionX + cumulativeXpos
        var y = config.settings[0].scenarioButtonsPositionY + 37
        // var transform = 'rotate(${rotateAngle}, ${x}, ${y})' // construct the transform attribute
        var transform = 'translate(0,-30)'

        buttonsCanvas.append('rect').style('pointer-events', 'all').attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + i + '_rect').attr('x', x).attr('y', y).attr('width', buttonWidth).attr('height', buttonHeight).attr('fill', function () {if (i == 0) { return '#333'} else return '#eee'}).style('stroke-width', 1).attr('rx', 3).attr('ry', 3).attr('transform', transform) // apply the transform attribute
          .on('mouseover', function () {
            d3.select(this).attr('fill', '#ddd')})
          .on('mouseout', function () {
            d3.select(this).attr('fill', '#eee')
            setScenario(activeScenario, 'soft')
          })
          .on('click', function () {
            muteHoover = true
            d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#eee')
            d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333')
            d3.select(this).transition().duration(200).attr('fill', '#333')
            d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee')
            activeScenario = this.id.slice(15, -5)
            adaptTotalHeight = 300
            tick()
          })

        buttonsCanvas.append('text').attr('class', 'buttonText_' + config.targetDIV).style('pointer-events', 'none').style('font-weight', 500).style('text-anchor', 'middle').attr('fill', function () {if (i == 0) { return '#FFF'} else return '#154273'}).attr('id', 'scenariobutton_' + i + '_text').attr('x', x + buttonWidth / 2).attr('y', y + 26).attr('transform', transform).style('font-size', '15px')
          .text(function () {
            return "'" + config.scenarios[i].title.substring(2, 4)
          })
        cumulativeXpos = cumulativeXpos + getTextWidth(config.scenarios[i].title, '16px', config.settings[0].font) + spacing
      }
    }
    if (config.settings[0].normalize.toLowerCase() == 'nee') {
      scaleInit = config.settings[0].scaleInit
    } else scaleInit = null

    function setScenario (scenario, type) {
      d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#eee')
      d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333')
      d3.select('#scenariobutton_' + scenario + '_rect').attr('fill', '#333')
      d3.select('#scenariobutton_' + scenario + '_text').attr('fill', '#eee')
      activeScenario = scenario

      d3.select('#scenarioIndicator').text(config.scenarios[activeScenario].title)
      if (type != 'soft') {tick()}
    }
    // init to 2021
    setScenario(31)

    headerCanvas.append('text').attr('fill', 'white').style('font-family', config.settings[0].fontFamily).style('font-size', 22 + 'px').attr('x', config.settings[0].titlePositionX).attr('y', config.settings[0].titlePositionY).text(config.settings[0].title)

    drawSankeyLegend(legend)
    function drawSankeyLegend () {
      let shiftY = config.settings[0].legendPositionTop
      let shiftX = config.settings[0].legendPositionLeft
      let box = 15
      let spacing = 30

      let legendEntries = []
      for (i = 0;i < legend.length;i++) {
        legendEntries.push({label: legend[i].id, color: legend[i].color, width: getTextWidth(legend[i].id, '13px', config.settings[0].font) + box + spacing})
      }

      let cumulativeWidth = 0
      for (i = 0; i < legendEntries.length; i++) {
        footerCanvas.append('rect').attr('x', cumulativeWidth + shiftX).attr('y', shiftY).attr('width', box).attr('height', box).attr('fill', legendEntries[i].color)
        footerCanvas.append('text').style('font-family', config.settings[0].font).attr('x', cumulativeWidth + shiftX + 25).attr('y', shiftY + box / 1.4).style('font-size', 13 + 'px').text(legendEntries[i].label)
        cumulativeWidth += legendEntries[i].width
      }
    }
  }

  function updateSankey (json, offsetX, offsetY, fontSize, fontFamily) {
    try {
      var json = JSON.parse(json)
      d3.select('#error').text('')
    } catch (e) { d3.select('#error').text(e); return; }
    sankeyLayout.nodePosition(function (node) {
      return [node.x, node.y]
    })

    d3.select('#sankeySVG').datum(sankeyLayout.scale(scaleInit)(json)).transition().duration(250).ease(d3.easeLinear).call(sankeyDiagram)
    d3.select('.sankey').attr('transform', 'translate(' + offsetX + ',' + offsetY + ')')
    d3.selectAll('.node-title').style('font-size', fontSize + 'px')
    d3.selectAll('.link').style('pointer-events', 'all')
    d3.selectAll('.node').style('pointer-events', 'all')
    d3.selectAll('.node-backdrop-title').style('pointer-events', 'none') // otherwise nodevalue text gets in the way of mouseclick 
    d3.selectAll('.node-click-target').style('fill', '#555').style('stroke-width', 0).attr('width', 10).attr('rx', 0).attr('ry', 0).attr('transform', 'translate(-4,0)scale(1.005)')
    // attach id's to link paths
    d3.select('.sankey').select('.links').selectAll('.link').select('path').attr('id', function (d, i) { return 'linkindex_' + d.index}).on('click', function () { createBarGraph(sankeyData.links[this.id.slice(10)], config) })
    // attach id's to node rects
    d3.select('.sankey').select('.nodes').selectAll('.node').select('.node-click-target').attr('id', function (d, i) {return 'linkindex_' + d.index}).on('click', function () { nodeVisualisatie(sankeyData.nodes[this.id.slice(10)], sankeyData, config.scenarios, config.targetDIV) })
  }

  // INIT
  setTimeout(() => {
    tick()
  }, 500)

  function tick () {
    for (i = 0; i < sankeyData.links.length; i++) {
      sankeyData.links[i].value = Math.round(sankeyData.links[i][config.scenarios[activeScenario].id])
    }
    updateSankey(JSON.stringify(sankeyData), config.settings[0].offsetX, config.settings[0].offsetY, config.settings[0].fontSize, config.settings[0].font)
    d3.selectAll('.node-title').style('font-size', '9px')
  }

  function getColor (id, legend) {
    for (let i = 0; i < legend.length; i++) {
      if (legend[i].id === id) {
        return legend[i].color
      }
    }
    console.log('WARNING: DID NOT FIND MATCHING LEGEND ENTRY - "' + id + '"')
    return 'black'
  }

  function getTextWidth (text, fontSize, fontFamily) {
    // Create a temporary span element
    const span = document.createElement('span')
    // Set the span's font properties
    span.style.fontSize = fontSize
    span.style.fontFamily = fontFamily
    // Set the span's text content
    span.textContent = text
    // Add the span to the body to measure its width
    document.body.appendChild(span)
    // Get the width of the span
    const width = span.offsetWidth
    // Remove the span from the body
    document.body.removeChild(span)
    // Return the width
    return width
  }

  function readExcelFile (url, callback) {
    // Create a new XMLHttpRequest object
    const xhr = new XMLHttpRequest()
    // Set up a callback for when the XMLHttpRequest finishes loading the file
    xhr.onload = () => {
      // Get the response data from the XMLHttpRequest
      const data = xhr.response
      // Create a new workbook object from the data
      const workbook = XLSX.read(data, {type: 'array'})
      // Define object variables for each sheet
      let links = {}
      let nodes = {}
      let legend = {}
      let settings = {}
      // Read the data from each sheet
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName]
        switch (sheetName) {
          case 'links':
            links = XLSX.utils.sheet_to_json(worksheet)
            break
          case 'nodes':
            nodes = XLSX.utils.sheet_to_json(worksheet)
            break
          case 'legend':
            legend = XLSX.utils.sheet_to_json(worksheet)
            break
          case 'settings':
            settings = XLSX.utils.sheet_to_json(worksheet)
            break
          default:
            console.log(`Sheet '${sheetName}' ignored.`)
        }
      })
      // Call the callback function with the resulting objects
      callback(links, nodes, legend, settings)
    }
    // Set up the XMLHttpRequest to load the file from the specified URL
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.send()
  }
}

function createBarGraph (data, config) {
  console.log(config)
  console.log(data)
  d3.select('#popupBlinder').style('visibility', 'visible').style('opacity', 0).transition().duration(300).style('opacity', 0.3)
  d3.select('#popupBlinder').style('pointer-events', 'all')
  d3.select('#' + config.targetDIV)
    // parent div 
    .append('div')
    .attr('id', 'nodeInfoPopup')
    .style('pointer-events', 'none')
    .style('position', 'absolute').style('top', '40px').style('left', '0px').style('width', '100%').style('height', '100%').style('display', 'flex').style('justify-content', 'center').style('align-items', 'center')
    // child div
    .append('div')
    .style('pointer-events', 'all')
    .attr('id', 'flowAnalysisPopup')
    .style('position', 'absolute')
    .style('box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-webkit-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-moz-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('margin', 'auto') // centers div
    .style('width', '1000px')
    .style('height', '500px')
    .style('background-color', 'rgba(255,255,255,1)')

  d3.select('#flowAnalysisPopup').append('svg').style('position', 'absolute').style('width', '100%').style('height', '100%').attr('id', 'flowAnalysisSVG_main').style('top', '0px').style('left', '0px')
  // d3.select('#flowAnalysisPopup').append('svg').style('position', 'relative').style('top', '70px').style('left', '20px').style('width', '1000px').style('height', '340px').attr('id', 'flowAnalysisSVG_incoming').attr('transform', 'translate(0,0)')
  // d3.select('#flowAnalysisPopup').append('svg').style('position', 'relative').style('width', '100%').style('top', '20px').style('left', '20px').style('height', '340px').attr('id', 'flowAnalysisSVG_outgoing').attr('transform', 'translate(0,0)')

  let canvas = d3.select('#flowAnalysisSVG_main').append('g')

  canvas.append('text').attr('x', 100).attr('y', 40).style('font-size', '16px').style('font-weight', 800)
    .text(function () {
      console.log(nodesGlobal)
      indexSource = nodesGlobal.findIndex(item => item.id === data.source)
      indexTarget = nodesGlobal.findIndex(item => item.id === data.target)

      // return "Flow '" + data.source + ' - ' + data.target + "'"
      return "Flow '" + nodesGlobal[indexSource].title + ' - ' + nodesGlobal[indexTarget].title + "'"
    })
  canvas.append('path').attr('d', 'M94.333 812.333 40 772.667 232 466l119.714 140 159.619-258.666 109 162.333q-18.333 1.667-35.166 6.167-16.834 4.5-33.5 11.166l-37.334-57-152.371 248.333-121.296-141-146.333 235ZM872.334 1016 741.333 885q-20.666 14.667-45.166 22.333-24.5 7.667-50.5 7.667-72.222 0-122.778-50.578-50.555-50.579-50.555-122.834t50.578-122.754q50.578-50.5 122.833-50.5T768.5 618.889Q819 669.445 819 741.667q0 26-8 50.5t-22 46.465l131 129.702L872.334 1016ZM645.573 848.334q44.76 0 75.761-30.907 31-30.906 31-75.666 0-44.761-30.907-75.761-30.906-31-75.666-31Q601 635 570 665.906q-31 30.906-31 75.667 0 44.76 30.906 75.761 30.906 31 75.667 31ZM724.666 523q-16.333-6.667-33.833-9.666-17.5-3-36.166-4.667l211-332.667L920 215.666 724.666 523Z').attr('transform', 'translate(40,15)scale(0.035)')
  // canvas.append('path').attr('d', 'M180 936q-24 0-42-18t-18-42V276q0-24 18-42t42-18h291v60H180v600h291v60H180Zm486-185-43-43 102-102H375v-60h348L621 444l43-43 176 176-174 174Z').attr('transform', 'translate(60,20)scale(0.025)')
  canvas.append('rect').attr('x', 30).attr('y', 60).attr('width', 940).attr('height', 410).attr('fill', '#eee')
  // canvas.append('rect').attr('x', 30).attr('y', 350).attr('width', 940).attr('height', 270).attr('fill', '#eee')
  // canvas.append('path').attr('d', 'M489 936v-60h291V276H489v-60h291q24 0 42 18t18 42v600q0 24-18 42t-42 18H489Zm-78-185-43-43 102-102H120v-60h348L366 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,70)scale(0.03)').attr('fill', '#888')
  // canvas.append('text').style('font-size', '12px').attr('x', 75).attr('y', 90).text('IN')
  // canvas.append('path').attr('d', 'M180 936q-24 0-42-18t-18-42V276q0-24 18-42t42-18h291v60H180v600h291v60H180Zm486-185-43-43 102-102H375v-60h348L621 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,360)scale(0.03)').attr('fill', '#888')
  // canvas.append('text').style('font-size', '12px').attr('x', 75).attr('y', 380).text('UIT')

  canvas.append('rect')
    .attr('x', 955).attr('y', 15)
    .attr('width', 30)
    .attr('height', 30)
    .attr('fill', '#FFF')
    .style('pointer-events', 'all')
    .on('mouseover', function () {
      d3.select(this).attr('fill', '#999')
      d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#fff')
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#fff')
      d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#000')
    })
    .on('click', function () {
      d3.select('#nodeInfoPopup').remove()
      d3.select('#popupBlinder').style('visibility', 'hidden')
      d3.select('#popupBlinder').style('pointer-events', 'none')
    })
  canvas.append('path').style('pointer-events', 'none').attr('id', config.targetDIV + '_closeButton').attr('d', 'm249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z').attr('transform', 'translate(951,7)scale(0.04)')

  console.log(data)
  // Define the dimensions of the chart
  const margin = { top: 10, right: 30, bottom: 30, left: 60 }
  const width = 750
  const height = 200 // d3.max(Object.values(data).filter(val => typeof val === 'number')) - margin.top - margin.bottom
  // Define the x and y scales
  const shiftX = 130
  let source = Object.entries(data).filter(([key, val]) => key.includes('scenario'))

  const x = d3.scaleBand()
    .range([0, width])
    .domain(Object.keys(data).filter(key => key.includes('scenario')).map(key => key.substring(0, key.indexOf('_'))))
    .padding(0.1)
  const y = d3.scaleLinear()
    .range([height, 0])
    .domain([0, d3.max(source.map(entry => entry[1]))])
  canvas.selectAll('.bar')
    .data(Object.entries(data).filter(([key, val]) => key.includes('scenario')))
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('fill', function (d, i) {
      // console.log(config.legend)
      // console.log(data.)
      index = config.legend.findIndex(item => item.id === data.legend)
      return config.legend[index].color
    })
    .attr('x', d => x(d[0].substring(0, d[0].indexOf('_'))))
    .attr('y', d => y(d[1]))
    .attr('width', x.bandwidth())
    .attr('height', d => height - y(d[1]))
    .attr('transform', 'translate(' + shiftX + ',150)')
  // Add the x-axis
  posx = shiftX
  posy = height + 150
  canvas.append('g')
    // .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .attr('transform', 'translate(' + posx + ',' + posy + ')')
    .selectAll('text')
    .style('font-size', '13px')
    .attr('transform', 'translate(-16,12)rotate(-45)')
    .text(function (d, i) {
      return config.scenarios[i].title // loose dependency, neaten
    })
  // Add the y-axis
  canvas.append('g')
    .call(d3.axisLeft(y))
    .attr('transform', 'translate(' + shiftX + ',' + 150 + ')')
    .selectAll('text')
    .style('font-size', '13px')
  // y-axis title
  canvas.append('text').attr('transform', 'translate(50,' + height * 1.2 + ')rotate(-90)').attr('dy', '1em').style('font-size', '12px').style('text-anchor', 'middle').text('Energie (PJ/jaar)')
}

function nodeVisualisatie (node, data, scenarios, targetDIV) {
  d3.select('#popupBlinder').style('visibility', 'visible').style('opacity', 0).transition().duration(300).style('opacity', 0.3)
  d3.select('#popupBlinder').style('pointer-events', 'all')

  d3.select('#' + targetDIV)
    // parent div 
    .append('div')
    .attr('id', 'nodeInfoPopup')
    .style('pointer-events', 'none')
    .style('position', 'absolute').style('top', '40px').style('left', '0px').style('width', '100%').style('height', '100%').style('display', 'flex').style('justify-content', 'center').style('align-items', 'center')
    // child div
    .append('div')
    .attr('id', 'nodeAnalysisPopup')
    .style('pointer-events', 'all')
    .style('position', 'absolute')
    .style('box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-webkit-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-moz-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('margin', 'auto') // centers div
    .style('width', '1000px')
    .style('height', '650px')
    .style('background-color', 'rgba(255,255,255,1)')

  d3.select('#nodeAnalysisPopup').append('svg').style('position', 'absolute').style('width', '100%').style('height', '100%').attr('id', 'nodeAnalysisSVG_main').style('top', '0px').style('left', '0px')
  d3.select('#nodeAnalysisPopup').append('svg').style('position', 'relative').style('top', '70px').style('left', '20px').style('width', '1000px').style('height', '340px').attr('id', 'nodeAnalysisSVG_incoming').attr('transform', 'translate(0,0)')
  d3.select('#nodeAnalysisPopup').append('svg').style('position', 'relative').style('width', '100%').style('top', '20px').style('left', '20px').style('height', '340px').attr('id', 'nodeAnalysisSVG_outgoing').attr('transform', 'translate(0,0)')

  let canvas = d3.select('#nodeAnalysisSVG_main').append('g')

  canvas.append('text').attr('x', 100).attr('y', 40).style('font-size', '16px').style('font-weight', 800).text("Node '" + node.title + "'")
  canvas.append('path').attr('d', 'M489 936v-60h291V276H489v-60h291q24 0 42 18t18 42v600q0 24-18 42t-42 18H489Zm-78-185-43-43 102-102H120v-60h348L366 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,20)scale(0.025)')
  canvas.append('path').attr('d', 'M180 936q-24 0-42-18t-18-42V276q0-24 18-42t42-18h291v60H180v600h291v60H180Zm486-185-43-43 102-102H375v-60h348L621 444l43-43 176 176-174 174Z').attr('transform', 'translate(60,20)scale(0.025)')
  canvas.append('rect').attr('x', 30).attr('y', 60).attr('width', 940).attr('height', 270).attr('fill', '#eee')
  canvas.append('rect').attr('x', 30).attr('y', 350).attr('width', 940).attr('height', 270).attr('fill', '#eee')
  canvas.append('path').attr('d', 'M489 936v-60h291V276H489v-60h291q24 0 42 18t18 42v600q0 24-18 42t-42 18H489Zm-78-185-43-43 102-102H120v-60h348L366 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,70)scale(0.03)').attr('fill', '#888')
  canvas.append('text').style('font-size', '12px').attr('x', 75).attr('y', 90).text('IN')
  canvas.append('path').attr('d', 'M180 936q-24 0-42-18t-18-42V276q0-24 18-42t42-18h291v60H180v600h291v60H180Zm486-185-43-43 102-102H375v-60h348L621 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,360)scale(0.03)').attr('fill', '#888')
  canvas.append('text').style('font-size', '12px').attr('x', 75).attr('y', 380).text('UIT')

  canvas.append('rect')
    .attr('x', 955).attr('y', 15)
    .attr('width', 30)
    .attr('height', 30)
    .attr('fill', '#FFF')
    .style('pointer-events', 'all')
    .on('mouseover', function () {
      d3.select(this).attr('fill', '#999')
      d3.select('#' + targetDIV + '_closeButton').attr('fill', '#fff')
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#fff')
      d3.select('#' + targetDIV + '_closeButton').attr('fill', '#000')
    })
    .on('click', function () {
      d3.select('#nodeInfoPopup').remove()
      d3.select('#popupBlinder').style('visibility', 'hidden')
      d3.select('#popupBlinder').style('pointer-events', 'none')
    })
  canvas.append('path').style('pointer-events', 'none').attr('id', targetDIV + '_closeButton').attr('d', 'm249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z').attr('transform', 'translate(951,7)scale(0.04)')
  // construct incoming dataset
  let dataIncoming = []
  for (i = 0;i < data.links.length;i++) {
    if (data.links[i].target == node.id) {
      dataIncoming.push(data.links[i])
    }
  }

  // construct outgoing dataset
  let dataOutgoing = []
  for (i = 0;i < data.links.length;i++) {
    if (data.links[i].source == node.id) {
      dataOutgoing.push(data.links[i])
    }
  }

  // add titles to links, source form nodes
  for (i = 0;i < dataIncoming.length;i++) {
    dataIncoming[i]['title'] = getTitleById(data.nodes, dataIncoming[i].source)
  }
  for (i = 0;i < dataOutgoing.length;i++) {
    dataOutgoing[i]['title'] = getTitleById(data.nodes, dataOutgoing[i].target)
  }

  // construct bargraph datasets
  let bargraphDataIncoming = []

  for (i = 0;i < scenarios.length;i++) {
    let lookupID = scenarios[i].id
    bargraphDataIncoming.push({scenario: scenarios[i].title})
    for (j = 0;j < dataIncoming.length;j++) {
      bargraphDataIncoming[i][dataIncoming[j].title + ' ' + '(' + dataIncoming[j].legend + ')' + '_' + j] = dataIncoming[j][lookupID]
    }
  }

  let bargraphDataOutgoing = []
  for (i = 0;i < scenarios.length;i++) {
    let lookupID = scenarios[i].id
    bargraphDataOutgoing.push({scenario: scenarios[i].title})
    for (j = 0;j < dataOutgoing.length;j++) {
      bargraphDataOutgoing[i][dataOutgoing[j].title + ' ' + '(' + dataOutgoing[j].legend + ')' + '_' + j] = dataOutgoing[j][lookupID]
    }
  }

  drawStackedBarChart(bargraphDataIncoming, 'nodeAnalysisSVG_incoming', {offsetX: 50, offsetY: 0})
  drawStackedBarChart(bargraphDataOutgoing, 'nodeAnalysisSVG_outgoing', {offsetX: 400, offsetY: 0})

  let nodeAnalysisSVG = d3.select('#nodeAnalysisSVG').append('g')

  let tempTotalOut = 0
  let tempTotalIn = 0
  for (i = 1; i < Object.keys(bargraphDataIncoming[0]).length;i++) {
    tempTotalIn += bargraphDataIncoming[0][Object.keys(bargraphDataIncoming[0])[i]]
  }
  for (i = 1; i < Object.keys(bargraphDataOutgoing[0]).length;i++) {
    tempTotalOut += bargraphDataOutgoing[0][Object.keys(bargraphDataOutgoing[0])[i]]
  }

  nodeAnalysisSVG.append('text').attr('x', 20).attr('y', 20).text('incoming: ' + tempTotalIn)
  nodeAnalysisSVG.append('text').attr('x', 20).attr('y', 50).text('outgoing: ' + tempTotalOut)

  function getTitleById (data, id_lookup) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === id_lookup) {
        return data[i].title
      }
    }
    return null // Return null if no object with matching id is found
  }
}

function drawStackedBarChart (data, svgId, config) {
  // Set the dimensions and margins of the graph
  var margin = { top: 40, right: 50, bottom: 30, left: 100 },
    width = 700 - margin.left - margin.right,
    height = 240 - margin.top - margin.bottom

  // Append the SVG object to the body of the page
  var svg = d3.select(`#${svgId}`).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom).append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
  // List of subgroups = header of the csv files = soil condition here
  var subgroups = Object.keys(data[0]).slice(1)
  // Find the maximum value of the stacked bar
  var maxValue = d3.max(data, function (d) {
    var sum = 0
    for (var i = 1; i < Object.keys(d).length; i++) {
      sum += d[Object.keys(d)[i]]
    }
    return sum
  })
  // List of groups = year
  var groups = data.map(function (d) {
    return d.scenario
  })

  // Add X axis
  var x = d3.scaleBand().domain(groups).range([0, width]).padding([0.2])
  svg.append('g').attr('transform', 'translate(0,' + height + ')').call(d3.axisBottom(x).tickSizeOuter(0).tickPadding(10)).selectAll('text').style('font-family', 'Open Sans').style('font-size', '12px').attr('transform', 'translate(-30,14)rotate(-45)').style('text-anchor', 'start')

  // Add Y axis
  var y = d3.scaleLinear().domain([0, maxValue]).range([height, 0])
  svg.append('g').call(d3.axisLeft(y)).selectAll('text').style('font-family', 'Open Sans').style('font-size', '12px')
  // Add Y axis title
  svg.append('text').attr('transform', 'rotate(-90)').attr('y', 0 - margin.left + 30).attr('x', 0 - (height / 2)).attr('dy', '1em').style('font-size', '12px').style('text-anchor', 'middle').text('Energie (PJ/jaar)')
  svg.append('text').attr('id', 'hooverText_' + svgId).attr('x', 10).attr('y', -20).text('')

  var color = d3.scaleOrdinal().domain(subgroups).range(d3.schemeCategory10)

  // stack the data?
  var stackedData = d3.stack().keys(subgroups)(data)

  // Show the bars
  svg
    .append('g')
    .selectAll('g')
    // Enter in the stack data = loop key per key = group per group
    .data(stackedData)
    .enter()
    .append('g')
    .attr('fill', function (d, i) {
      return color(d.key)
    })
    .attr('data-key', function (d) { return d.key}) // store key in order to be able to reference legend entry on hoover over bar rect
    .attr('data-index', function (d) {return d.index})
    .selectAll('rect')
    // enter a second time = loop subgroup per subgroup to add all rectangles
    .data(function (d) {
      return d
    })
    .enter()
    .append('rect')

    .attr('data-scenario', function (d) {return d.data.scenario})
    .attr('data-totaal', function (d) {
      let totaal = 0
      for (cnt = 1;cnt < Object.keys(d.data).length;cnt++) { // start at 1: skip first entry, which is non-data (scenario title)
        totaal += parseFloat(d.data[Object.keys(d.data)[cnt]])
      }
      return totaal
    })
    .attr('data-focus', function (d) {
      return JSON.stringify(d.data)
    })
    .attr('x', function (d) {
      return x(d.data.scenario)
    })
    .attr('y', function (d) {
      if (isNaN(y(d[1]))) {
        return 20
      } else {return y(d[1])}
    })
    .attr('height', function (d) {
      if (isNaN(y(d[0])) || isNaN(y(d[1]))) {
        return 20
      } else { return y(d[0]) - y(d[1])}
    })
    .attr('width', x.bandwidth())
    // .attr('data-legend', function (d) {console.log(d.key); return d})
    .on('mouseover', function (d) {
      // console.log(d)
      let ident = d3.select(this.parentNode).attr('data-key')
      let focus = JSON.parse(d3.select(this).attr('data-focus'))
      let focusResult = Math.round(focus[ident])
      const index = ident.lastIndexOf('_'); // find the index of the last occurrence of '_'
      const ident_formatted = index !== -1 ? ident.slice(0, index) : ident; // slice the string up to the index or return the original string if '_' is not found

      let scenario = d3.select(this).attr('data-scenario')
      let total = parseFloat(d3.select(this).attr('data-totaal'))
      let percentageOfTotal = Math.round(((focusResult / total) * 100))

      d3.select('#hooverText_' + svgId).text(ident_formatted + ', ' + focusResult + ' PJ (' + percentageOfTotal + '%)' + ' - ' + scenario + ' | TOTAAL: ' + Math.round(total))

      d3.select(this).style('opacity', 0.8)
    })
    .on('mouseout', function () {
      d3.select('#hooverText_' + svgId).text('')
      d3.select(this).style('opacity', 1)
    })

  // Add legend
  var legend = d3.select('#' + svgId).append('g').attr('font-size', 11).attr('text-anchor', 'start').selectAll('g').data(subgroups.slice().reverse()).enter().append('g').attr('transform', function (d, i) { let ypos = i * 16 + 20
    return 'translate(' + (width + margin.left + margin.right - 20) + ',' + ypos + ')' }).style('opacity', 1) // Increase opacity to make it visible

  // only draw legend if legend entries under 15
  if (Object.keys(data[0]).length < 14) {
    legend.append('rect').attr('x', 0).attr('width', 13).attr('height', 13).attr('fill', color)
    legend.append('text').attr('x', 20).attr('y', 11).text(function (d) {return d.slice(0, -2);})
  }else { d3.select('#' + svgId).append('g').append('text').style('font-size', '12px').text('Legenda weergave is niet mogelijk, het aantal grafiek-elementen overschrijdt het maximum voor weergave. Beweeg met de muis over de grafiek voor een interactieve legenda.').call(wrap, 200).attr('transform', 'translate(670,70)')}
}

function wrap (text, width) {
  text.each(function () {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1, // ems
      y = text.attr('y'),
      dy = parseFloat(text.attr('dy'))
    if (isNaN(dy)) {dy = 0}
    var tspan = text.text(null).append('tspan').attr('x', 10).attr('y', y).attr('dy', dy + 'em')
    while (word = words.pop()) {
      line.push(word)
      tspan.text(line.join(' '))
      if (tspan.node().getComputedTextLength() > width) {
        line.pop()
        tspan.text(line.join(' '))
        line = [word]
        tspan = text.append('tspan').attr('x', 10).attr('y', 0).attr('dy', ++lineNumber * lineHeight + dy + 'em').text(word) // changed x from 0 to 20 TIJS
      }
    }
  })
}
