#' Profvis UI for Shiny Apps
#'
#' Use this Shiny module to inject Profvis controls into your Shiny app. The
#' Profvis Shiny module injects UI that can be used to start and stop profiling,
#' and either view the results in the Profvis UI or download the raw .Rprof
#' data. It is highly recommended that this be used for testing and debugging
#' only, and not included in production apps!
#'
#' The usual way to use Profvis with Shiny is to simply call
#' `profvis(shiny::runApp())`, but this may not always be possible or desirable:
#' first, if you only want to profile a particular interaction in the Shiny app
#' and not capture all the calculations involved in starting up the app and
#' getting it into the correct state; and second, if you're trying to profile an
#' application that's been deployed to a server.
#'
#' For more details on how to invoke Shiny modules, see [this
#' article](https://shiny.rstudio.com/articles/modules.html).
#'
#' @param id Output id from \code{profvis_server}.
#'
#' @examples
#' # In order to avoid "Hit <Return> to see next plot" prompts,
#' # run this example with `example(profvis_ui, ask=FALSE)`
#'
#' if(interactive()) {
#'   library(shiny)
#'   library(ggplot2)
#'   shinyApp(
#'     fluidPage(
#'       plotOutput("plot"),
#'       actionButton("new", "New plot"),
#'       profvis_ui("profiler")
#'     ),
#'     function(input, output, session) {
#'       callModule(profvis_server, "profiler")
#'
#'       output$plot <- renderPlot({
#'         input$new
#'         ggplot(diamonds, aes(carat, price)) + geom_point()
#'       })
#'     }
#'   )
#' }
#'
#' @export
profvis_ui <- function(id) {
  if (!requireNamespace("shiny", quietly = TRUE)) {
    stop('profvis_ui requires the shiny package.')
  }
  ns <- shiny::NS(id)

  style <- htmltools::css(
    padding = "6px",
    white_space = "nowrap",
    top = "-1px",
    border_top_left_radius = "0",
    border_top_right_radius = "0",
    box_shadow = "none",
    z_index = 9000
  )

  shiny::tagList(
    tags$style(
      ".profvis-module-container:empty() { visibility: hidden; }"
    ),
    shiny::fixedPanel(
      top = 0, left = -1, width = "auto", height = "auto",
      class = "profvis-module-container well", style = style, draggable = TRUE,

      shiny::uiOutput(ns("button_group"), class = "btn-group")
    ),
    # TODO: Make htmlDependency
    shiny::singleton(shiny::includeScript(system.file("shinymodule/draggable-helper.js", package = "profvis")))
  )
}

#' @param input,output,session Arguments provided by
#'   \code{\link[shiny]{callModule}}.
#' @param dir Output directory to save Rprof files.
#'
#' @rdname profvis_ui
#' @export
profvis_server <- function(input, output, session, dir = ".") {
  if (!requireNamespace("shiny", quietly = TRUE)) {
    stop('profvis_server requires the shiny package.')
  }
  # Whether we're currently profiling
  profiling <- shiny::reactiveVal(FALSE)
  # The current/most recent profile
  current_profile <- shiny::reactiveVal(NULL)

  profiles <- function() {
    dir(dir, pattern = "\\.Rprof$")
  }

  shiny::setBookmarkExclude(c("start_rprof", "browse", "dl_rprof", "dl_profvis", "download"))

  shiny::observeEvent(input$start_rprof, {
    if (!profiling()) {
      proffile <- file.path(dir, strftime(Sys.time(), "%Y-%m-%d_%H-%M-%S.Rprof"))
      Rprof(proffile,
        interval = 0.01, line.profiling = TRUE,
        gc.profiling = TRUE, memory.profiling = TRUE)
      current_profile(proffile)
      profiling(TRUE)
    }
  })

  output$button_group <- shiny::renderUI({
    profiling()

    ns <- session$ns

    shiny::isolate({
      browseBtn <- shiny::actionButton(class = "btn-xs", ns("browse"), NULL, shiny::icon("list-ul"))

      if (!profiling()) {
        htmltools::tagList(
          shiny::actionButton(class = "btn-xs", ns("start_rprof"), "Start profiling", shiny::icon("play")),
          if (length(profiles()) > 0) browseBtn
        )
      } else {
        # Register a URL for the "Stop Recording" button to go to.
        # Requesting this URL will stop the current profiling session, update
        # the profiling() reactiveVal, and return a new profvis.
        url <- session$registerDataObj("stop_profvis_module", list(), function(data, req) {
          shiny::isolate({
            Rprof(NULL)
            profiling(FALSE)

            # profiling(FALSE) should cause a flushReact, but doesn't. This
            # invalidateLater is a hack to force one (since it's inside an
            # isolate, it otherwise has no effect).
            shiny::invalidateLater(50)

            if (is.null(current_profile())) {
              stop("Invalid state detected")
            }

            # Create a profvis and save it to a self-contained temp .html file
            p <- profvis(prof_input = current_profile())
            outfile <- tempfile("profvis", fileext = ".html")
            htmlwidgets::saveWidget(p, outfile)

            # Return as HTML. Since owned=TRUE, httpuv will take care of deleting
            # the temp file when it's done streaming it to the client.
            list(
              status = 200L,
              headers = list(
                "Content-Type" = "text/html;charset=utf-8"
              ),
              body = list(
                file = outfile,
                owned = TRUE
              )
            )
          })
        })

        htmltools::tagList(
          htmltools::tags$a(class = "btn btn-default btn-xs", target = "_blank", href = url, shiny::icon("stop"), "Stop profiling")
        )
      }
    })
  })

  shiny::observeEvent(input$browse, {
    ns <- session$ns

    shiny::showModal(shiny::modalDialog(
      shiny::uiOutput(ns("download_select")),
      shiny::downloadButton(ns("dl_rprof"), "Download as Rprof", class = "btn-xs"),
      shiny::downloadButton(ns("dl_profvis"), "Download as profvis", class = "btn-xs")
    ))
  })

  shiny::onSessionEnded(function() {
    # Make sure we stop profiling when session exits
    Rprof(NULL)
  })

  output$download_select <- shiny::renderUI({
    shiny::req(!profiling(), cancelOutput = TRUE)
    ns <- session$ns
    shiny::selectInput(ns("download"), "Select profile to download",
                choices = sort(profiles(), decreasing = TRUE)
    )
  })

  # Validate input$download so we don't just let the user download whatever
  # file they want from the server.
  download <- shiny::reactive({
    dl <- input$download
    shiny::validate(shiny::need(isTRUE(dl %in% profiles()), "Illegal download or not found"))
    dl
  })

  output$dl_rprof <- shiny::downloadHandler(
    filename = function() {
      file.path(dir, download())
    },
    content = function(file) {
      file.copy(
        file.path(dir, download()),
        file
      )
    }
  )

  output$dl_profvis <- shiny::downloadHandler(
    filename = function() {
      file.path(dir, sub("Rprof$", "html", download()))
    },
    content = function(file) {
      p <- profvis(prof_input = download())
      htmlwidgets::saveWidget(p, file)
    }
  )
}
